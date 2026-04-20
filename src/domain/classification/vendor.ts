import type { VendorId } from "../shared/ids.js";

export interface Vendor {
  readonly id: VendorId;
  readonly displayName: string;
  readonly rotateUrl: string;
}
