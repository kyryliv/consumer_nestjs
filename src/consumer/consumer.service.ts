import { Injectable, Logger } from "@nestjs/common";
import { RmqContext } from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";
import { KintositeService } from "../kintosite/kintosite.service";
import axios from "axios";

@Injectable()
export class ConsumerService {
  private readonly logger = new Logger(ConsumerService.name);

  constructor(
    private readonly kintositeService: KintositeService,
    private readonly config: ConfigService,
  ) { }

  async handleFundsListUpdate(
    payload: { message: string },
    context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef();
    const originalMessage = context.getMessage();

    try {
      const fundsList = JSON.parse(payload.message);
      await this.kintositeService.executeById(
        "funds_list.update",
        { funds_list: fundsList },
      );
      channel.ack(originalMessage);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to forward funds list payload: ${message}`);
      channel.nack(originalMessage, false, true);
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

      await this.kintositeService.executeById(
        "shoporders.update",
        shoporders.data,
      );

      // this.logger.debug(`shoporders are updating, count: ${Object.keys(shoporders.data).length}`);
      await this.processAssets(shoporders);
      channel.ack(originalMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to forward shoporders payload: ${message}`);
//       channel.nack(originalMessage, false, true);
      channel.ack(originalMessage);
    }
  }

  private async processAssets(source: unknown): Promise<void> {
    const shoporderRows = this.extractShopordersRows(source);
    let bonds: Record<string, unknown>[] | undefined = undefined;

    for (const row of shoporderRows) {
      const isin: string | undefined = this.getStringValue(row, "ISIN");
      const qty: number | undefined = this.getNumberValue(row, "QTY");
      const shopordertype_id: number | undefined = this.getNumberValue(row, "SHOPORDERTYPEID");
      const objectcategory_id: number | undefined = this.getNumberValue(row, "OBJECTCATEGORYID");

      if (!isin) {
        continue;
      }

      let data: Record<string, unknown> =
      {
        shop: (shopordertype_id === 1 || shopordertype_id === 3) ? { sell_qty: qty } : { buy_qty: qty }
      };

      try {

        await this.kintositeService.executeById("asset.get", { isin });
        await this.kintositeService.executeById("asset.update", {
          isin: isin,
          asset: { data: data },
        });

      } catch (error) {

        const message = error instanceof Error ? error.message : String(error);

        if (message.includes("HTTP 404")) {

          try {

            let title: string | undefined = this.getStringValue(row, "OBJECTNAME");
            if (!title) {
              title = `Asset ${isin}`;
            }

            if (objectcategory_id === 4) {

              if (!bonds) {
                bonds = await this.fetchBonds();
              }

              if (!bonds) {
                this.logger.error(`Failed to fetch bonds from NBU, cannot create asset with ISIN ${isin}`);
                continue;
              }

              const bondRecord = bonds.find((item) => {
                const cpcode = item["cpcode"] as string;
                return typeof cpcode === "string"
                  ? cpcode.trim().toUpperCase() === isin
                  : String(cpcode).trim().toUpperCase() === isin;
              });

              if (!bondRecord) {
                this.logger.error(
                  `Asset with ISIN ${isin} not found in bonds, skipping...`,
                );
                continue;
              }

              if (bondRecord.pgs_date) {
                const formattedPgsDate = this.formatYmdToDmy(bondRecord.pgs_date);
                title = `ОВДП (погашення ${formattedPgsDate ?? bondRecord.pgs_date})`;
              }

              data.nominal = bondRecord.nominal;
              data.bond = {
                finish_date: bondRecord.pgs_date,
                start_date: bondRecord.razm_date,
                pay_period: bondRecord.pay_period,
                payments: (bondRecord.payments as Array<Record<string, unknown>>).map(
                  ({ array: _, ...rest }) => rest,
                ),
              }
            }

            let asset = {
              title: title,
              object_id: row.OBJECTID,
              category_id: row.OBJECTCATEGORYID,
              category_name: row.OBJECTCATEGORYNAME,
              data: data,
            };

            await this.kintositeService.executeById("asset.create", {
              isin: isin,
              asset: asset,
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

  private async fetchBondRecord(isin: string): Promise<Record<string, unknown> | undefined> {
    const url = this.config.get<string>("BANK_GOV_UA_URL");
    if (!url) {
      this.logger.warn("BANK_GOV_UA_URL is not configured");
      return undefined;
    }

    try {
      const response = await axios.get<Array<Record<string, unknown>>>(url);
      const normalizedIsin = isin.trim().toUpperCase();

      return response.data.find((item) => {
        const cpcode = item["cpcode"] as string;
        return typeof cpcode === "string"
          ? cpcode.trim().toUpperCase() === normalizedIsin
          : String(cpcode).trim().toUpperCase() === normalizedIsin;
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch depo security for ISIN ${isin}: ${message}`);
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

    for (const key of ["broker", "custody"]) {
      const maybeArray = payloadData[key];
      if (!Array.isArray(maybeArray)) {
        continue;
      }

      for (const item of maybeArray) {
        if (item && typeof item === "object") {
          rows.push(item as Record<string, unknown>);
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
