import { Job } from "../types";
import { refinePitch as refine } from "./ai";

export async function refinePitch(job: Job, currentDraft: string): Promise<string> {
  return await refine(job, currentDraft);
}
