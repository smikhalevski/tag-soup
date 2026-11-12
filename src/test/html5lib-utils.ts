import fs from 'node:fs';

/**
 * The commit of [web-platform-tests](https://github.com/web-platform-tests/wpt) that tree construction tests are
 * downloaded from.
 */
export const WPT_COMMIT_SHA = '28c152b74f8679534e558745fe83312c8dcca8c8';

/**
 * Names of files with tree construction tests in
 * [html/syntax/parsing/resources](https://github.com/web-platform-tests/wpt/tree/master/html/syntax/parsing/resources).
 * Files with scripted tests are omitted, since they need document.write.
 */
export const html5libTestFileNames = [
  'adoption01.dat',
  'adoption02.dat',
  'blocks.dat',
  'comments01.dat',
  'doctype01.dat',
  'domjs-unsafe.dat',
  'entities01.dat',
  'entities02.dat',
  'foreign-fragment.dat',
  'html5test-com.dat',
  'inbody01.dat',
  'isindex.dat',
  'main-element.dat',
  'math.dat',
  'menuitem-element.dat',
  'namespace-sensitivity.dat',
  'noscript01.dat',
  'pending-spec-changes-plain-text-unsafe.dat',
  'pending-spec-changes.dat',
  'plain-text-unsafe.dat',
  'processing-instructions.dat',
  'quirks01.dat',
  'ruby.dat',
  'scriptdata01.dat',
  'search-element.dat',
  'svg.dat',
  'tables01.dat',
  'template.dat',
  'tests1.dat',
  'tests10.dat',
  'tests11.dat',
  'tests12.dat',
  'tests14.dat',
  'tests15.dat',
  'tests16.dat',
  'tests17.dat',
  'tests18.dat',
  'tests19.dat',
  'tests2.dat',
  'tests20.dat',
  'tests21.dat',
  'tests22.dat',
  'tests23.dat',
  'tests24.dat',
  'tests25.dat',
  'tests26.dat',
  'tests3.dat',
  'tests4.dat',
  'tests5.dat',
  'tests6.dat',
  'tests7.dat',
  'tests8.dat',
  'tests9.dat',
  'tests_innerHTML_1.dat',
  'tricky01.dat',
  'void-in-phrasing.dat',
  'webkit01.dat',
  'webkit02.dat',
];

/**
 * The directory where downloaded files are cached, so tests don't need network once files are downloaded.
 */
export const html5libTestsDir = new URL(
  '../../node_modules/.cache/tag-soup/wpt-' + WPT_COMMIT_SHA + '/',
  import.meta.url
);

/**
 * Downloads files that aren't in the cache yet.
 */
export async function downloadHtml5libTests(): Promise<void> {
  fs.mkdirSync(html5libTestsDir, { recursive: true });

  await Promise.all(
    html5libTestFileNames.map(async fileName => {
      const fileURL = new URL(fileName, html5libTestsDir);

      if (fs.existsSync(fileURL)) {
        return;
      }

      const url =
        'https://raw.githubusercontent.com/web-platform-tests/wpt/' +
        WPT_COMMIT_SHA +
        '/html/syntax/parsing/resources/' +
        fileName;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Cannot download ' + url + ': ' + response.status);
      }

      // The file is renamed after it's written, so an interrupted download doesn't leave a partial file in the cache
      const tempFileURL = new URL(fileName + '.download', html5libTestsDir);

      await fs.promises.writeFile(tempFileURL, Buffer.from(await response.arrayBuffer()));
      await fs.promises.rename(tempFileURL, fileURL);
    })
  );
}
