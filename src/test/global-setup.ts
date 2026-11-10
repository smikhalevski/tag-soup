import { downloadHtml5libTests } from './html5lib-tests.ts';

export async function setup(): Promise<void> {
  await downloadHtml5libTests();
}
