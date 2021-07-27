import {createAttributeToken, createStartTagToken} from '../main/tokens';
import {IAttributeToken} from '../main';

describe('clone', () => {

  test('deeply clones a start tag token', () => {

    const token = createStartTagToken();
    token.attributes[0] = createAttributeToken();
    token.attributes[1] = undefined as unknown as IAttributeToken;
    token.attributes.length = 1;

    const clonedToken = token.clone();

    expect(token).toEqual(clonedToken);
    expect(token).not.toBe(clonedToken);
    expect(token.attributes).not.toBe(clonedToken.attributes);
    expect(token.attributes[0]).not.toBe(clonedToken.attributes[0]);
    expect(1 in token.attributes).toBe(true);
  });
});
