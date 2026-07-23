import { Injectable, Logger } from "@nestjs/common";
import { RmqContext } from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";
import { KintositeService } from "@kinto/connectivity-nestjs/kintosite";
import axios from "axios";

@Injectable()
export class ConsumerService {
  private readonly logger = new Logger(ConsumerService.name);

  constructor(
    private readonly kintositeService: KintositeService,
    private readonly config: ConfigService,
  ) { }

  async handleFundUpdate(
    payload: { message: string },
    context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef();
    const originalMessage = context.getMessage();

    try {

      const data = JSON.parse(payload.message);

      if (!data || typeof data !== "object") {
        console.log(data);
        throw new Error("Parsed fund payload is not an object");
      }

      if (!data?.isin || typeof data?.isin !== "string") {
        throw new Error("Parsed fund payload has an invalid isin");
      }

      if (!data?.asset || typeof data?.asset !== "object") {
        throw new Error("Parsed fund payload is missing a valid asset object");
      }
      // this.logger.debug(`Received fund data:${JSON.stringify(data) ?? "unknown"}`);

      await this.kintositeService.executeById("fund.update", {
        isin: data?.isin,
        fund: data,
      });

      channel.ack(originalMessage);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to forward fund payload: ${message}`);
      // channel.nack(originalMessage, false, true);
      channel.ack(originalMessage);
    }
  }

  async handleShopordersUpdate(
    payload: { message: string },
    context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef();
    const originalMessage = context.getMessage();

    try {
      const shoporders = JSON.parse(payload.message);

      if (!shoporders?.data || typeof shoporders?.data !== "object") {
        throw new Error("Parsed shoporders payload is not an object");
      }

      await this.kintositeService.executeById("shoporders.update", shoporders.data);

      await this.processAssets(shoporders);
      this.logger.log(`Successfully processed assets from shoporders payload`);

      channel.ack(originalMessage);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to forward shoporders payload: ${message}`);
      channel.ack(originalMessage);
    }
  }

  private async processAssets(source: unknown): Promise<void> {

    const shoporderRows = this.extractShopordersRows(source);
    const bonds = await this.fetchBonds();

    if (!bonds) {
      this.logger.warn("No bonds data available, skipping bond processing");
    }

    for (const row of shoporderRows) {
      const isin: string | undefined = this.getStringValue(row, "ISIN");

      if (!isin) {
        continue;
      }

      const category_id: number | undefined = this.getNumberValue(row, "OBJECTCATEGORYID");
      const category_name: string | undefined = this.getStringValue(row, "OBJECTCATEGORYNAME");
      const object_id: number | undefined = this.getNumberValue(row, "OBJECTID");
      const title: string | undefined = this.getStringValue(row, "OBJECTNAME");
      const emitentedrpou: string | undefined = this.getStringValue(row, "EMITENTEDRPOU");

      if (
        !category_id
        || !category_name
        || !object_id
        || !title
        || !emitentedrpou
      ) {
        this.logger.warn(`Skipping asset with ISIN ${isin} due to missing information`);
        continue;
      }

      let data: Record<string, unknown> =
      {
        isin: isin,
        category_id: category_id,
        category_name: category_name,
        object_id: object_id,
        title: title,
        edrpou: emitentedrpou,
      };

      try {

        await this.kintositeService.executeById("asset.update", {
          isin: isin,
          asset: data,
        });

      } catch (error) {

        const message = error instanceof Error ? error.message : String(error);

        if (message.includes("HTTP 404")) {

          try {

            if (bonds && category_id == 4) {

              const bondResult = await this.processBond({
                bonds: bonds,
                category_id: category_id,
                isin: isin,
              });

              if (bondResult.skip) {
                continue;
              }

              data.title = bondResult.title;
              data.bond = bondResult.bond;

            }

            await this.kintositeService.executeById("asset.create", {
              isin: isin,
              ...data,
            });

          } catch (error) {

            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to create asset with ISIN ${isin}: ${message}`);

          }
        }
        else {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to process asset with ISIN ${isin}: ${message} {status: ${error instanceof Error ? (error as any).status : "unknown"}}`);
        }
      }
    }
  }

  private async processBond(params: {
    bonds: Record<string, unknown>[] | undefined;
    category_id: number | undefined;
    isin: string;
  }): Promise<{
    skip: boolean;
    title: string | undefined;
    bond: Record<string, unknown> | undefined;
  }> {
    const { bonds, category_id, isin } = params;

    if (!bonds || category_id !== 4) {
      return { skip: true, title: undefined, bond: undefined };
    }

    const bondRecord = bonds.find((item) => {
      const cpcode = item["cpcode"] as string;
      return typeof cpcode === "string"
        ? cpcode.trim().toUpperCase() === isin
        : String(cpcode).trim().toUpperCase() === isin;
    });

    if (!bondRecord) {
      this.logger.error(`Asset with ISIN ${isin} not found in bonds, skipping...`);
      return { skip: true, title: undefined, bond: undefined };
    }

    let title: string | undefined = isin;
    if (bondRecord.pgs_date) {
      const formattedPgsDate = this.formatYmdToDmy(bondRecord.pgs_date);
      title = `ОВДП (погашення ${formattedPgsDate ?? bondRecord.pgs_date})`;
    }

    const bond = {
      nominal: bondRecord.nominal,
      finish_date: bondRecord.pgs_date,
      start_date: bondRecord.razm_date,
      pay_period: bondRecord.pay_period,
      payments: (bondRecord.payments as Array<Record<string, unknown>>).map(
        ({ array: _, ...rest }) => rest,
      ),
    };

    return { skip: false, title: title, bond: bond };
  }

  private async fetchBonds(): Promise<Record<string, unknown>[] | undefined> {
    const url = this.config.get<string>("BANK_GOV_UA_URL");
    if (!url) {
      this.logger.warn("BANK_GOV_UA_URL is not configured");
      return undefined;
    }

    try {

      const res = await axios.get<Array<Record<string, unknown>>>(url);
      if (!res) {
        this.logger.warn(`Received empty response from ${url}`);
        return undefined;
      }

      return Array.isArray(res.data) ? res.data : undefined;

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch bonds from NBU: ${message}`);
      return undefined;
    }
  }

  private extractShopordersRows(source: unknown): Array<Record<string, unknown>> {

    if (!source || typeof source !== "object") {
      return [];
    }

    const candidate = source as Record<string, unknown>;
    const payloadData =
      candidate.data && typeof candidate.data === "object"
        ? (candidate.data as Record<string, unknown>)
        : candidate;
    const rows: Array<Record<string, unknown>> = [];
    const seenIsins = new Set<string>();

    for (const value of Object.values(payloadData)) {
      if (!Array.isArray(value)) {
        continue;
      }

      for (const item of value) {
        if (item && typeof item === "object") {
          const row = item as Record<string, unknown>;
          const isin = this.getStringValue(row, "ISIN");
          if (!isin) {
            continue;
          }

          const normalizedIsin = isin.trim().toUpperCase();
          if (seenIsins.has(normalizedIsin)) {
            continue;
          }

          seenIsins.add(normalizedIsin);
          rows.push(row);
        }
      }
    }

    return rows;
  }

  private getStringValue(
    row: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
    return undefined;
  }

  private getNumberValue(
    row: Record<string, unknown>,
    key: string,
  ): number | undefined {
    const value = row[key];
    if (typeof value === "number") {
      return value;
    }
    return undefined;
  }

  private formatYmdToDmy(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }

    const parts = value.trim().split("-");
    if (parts.length !== 3) {
      return undefined;
    }

    const [year, month, day] = parts;
    if (year.length !== 4 || month.length !== 2 || day.length !== 2) {
      return undefined;
    }

    return `${day}.${month}.${year}`;
  }

  handleEtc(
    payload: { message: string; createdAt?: string },
    context: RmqContext,
  ): void {
    const channel = context.getChannelRef();

    this.logger.log(
      `Received message with routing key: ${String(context.getPattern())}`,
    );

    const originalMessage = context.getMessage();
    channel.ack(originalMessage);
  }
}
