import cheerio from 'cheerio';
import {createXmlDomParser, domHandler} from '../main/createXmlDomParser';
import {Element, Node, Text} from 'domhandler';


describe('', () => {
  test('ads', () => {

    const parser = createXmlDomParser<Node, Element, Text>();


    const dom = parser.parse(domHandler, '<a></a>')

    cheerio.load(dom);

  })

})
