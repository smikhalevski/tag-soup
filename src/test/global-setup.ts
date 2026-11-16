import { downloadHtml5libTests } from './html5lib-utils.ts';

export async function setup(): Promise<void> {
  await downloadHtml5libTests();
}
