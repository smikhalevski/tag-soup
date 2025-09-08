import type { RuleIterator } from 'tokenizer-dsl';
import { endTagOpeningRuleTo as nextStage } from '../lexer-utils';
import { startTagClosingRuleTo as nextStage2 } from '../lexer-utils';
import { startTagSelfClosingRuleTo as nextStage3 } from '../lexer-utils';
export default (function (): RuleIterator<any, any, any> {
  const nextStage4 = 'DOCUMENT';
  const nextStage5 = 'START_TAG';
  const nextStage6 = 'ATTRIBUTE_NAME';
  const tokenType = 'ATTRIBUTE_VALUE';
  const stage = 'CDATA_TAG';
  const stage2 = 'END_TAG';
  const tokenType2 = 'START_TAG_OPENING';
  const tokenType3 = 'END_TAG_OPENING';
  const str = '-->';
  const tokenType4 = 'COMMENT';
  const str2 = ']]>';
  const tokenType5 = 'CDATA_SECTION';
  const str3 = '>';
  const tokenType6 = 'DOCTYPE';
  const tokenType7 = 'DTD';
  const str4 = '?>';
  const tokenType8 = 'PROCESSING_INSTRUCTION';
  const str5 = '<';
  const tokenType9 = 'TEXT';
  const tokenType10 = 'START_TAG_CLOSING';
  const tokenType11 = 'START_TAG_SELF_CLOSING';
  const str6 = '"';
  const str7 = "'";
  const tokenType12 = 'ATTRIBUTE_UNQUOTED_VALUE';
  const tokenType13 = 'END_TAG_CLOSING';
  return function (state, handler, context, streaming) {
    var stage3 = state.stage,
      chunk = state.chunk,
      offset = state.offset,
      tokenPending = false,
      pendingTokenType,
      nextOffset = offset,
      chunkLength = chunk.length;
    while (nextOffset < chunkLength) {
      switch (stage3) {
        case nextStage4:
          var branchResult;
          var charCode;
          branchResult =
            nextOffset < chunk.length && ((charCode = chunk.charCodeAt(nextOffset)), charCode === 60)
              ? nextOffset + 1
              : -1;
          if (branchResult > nextOffset) {
            var branchResult2;
            branchResult2 = -1;
            var index = branchResult,
              readerResult;
            var charCode2;
            readerResult =
              index < chunk.length &&
              ((charCode2 = chunk.charCodeAt(index)),
              (charCode2 >= 97 && charCode2 <= 122) ||
                (charCode2 >= 65 && charCode2 <= 90) ||
                charCode2 === 95 ||
                charCode2 === 58 ||
                (charCode2 >= 192 && charCode2 <= 214) ||
                (charCode2 >= 216 && charCode2 <= 246) ||
                (charCode2 >= 248 && charCode2 <= 767) ||
                (charCode2 >= 880 && charCode2 <= 893) ||
                (charCode2 >= 895 && charCode2 <= 8191) ||
                (charCode2 >= 8204 && charCode2 <= 8205) ||
                (charCode2 >= 8304 && charCode2 <= 8591) ||
                (charCode2 >= 11264 && charCode2 <= 12271) ||
                (charCode2 >= 12289 && charCode2 <= 55295) ||
                (charCode2 >= 63744 && charCode2 <= 64975) ||
                (charCode2 >= 65008 && charCode2 <= 65533) ||
                (charCode2 >= 65536 && charCode2 <= 983039))
                ? index + 1
                : -1;
            if (readerResult >= index) {
              index = readerResult;
              readerResult = -1;
              var inputLength = chunk.length,
                index2 = index,
                charCode3;
              do {
                if (index2 >= inputLength) break;
                charCode3 = chunk.charCodeAt(index2);
                if (
                  charCode3 === 32 ||
                  charCode3 === 9 ||
                  charCode3 === 13 ||
                  charCode3 === 10 ||
                  charCode3 === 47 ||
                  charCode3 === 62
                ) {
                  readerResult = index2;
                  break;
                }
                ++index2;
              } while (true);
              if (readerResult < index) {
                readerResult = chunk.length;
              }
              if (readerResult >= index) {
                branchResult2 = readerResult;
              }
            }
            if (branchResult2 > branchResult) {
              if (tokenPending) {
                handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
                tokenPending = false;
              }
              state.stage = stage3;
              state.offset = offset = nextOffset;
              tokenPending = true;
              pendingTokenType = tokenType2;
              stage3 = nextStage5;
              nextOffset = branchResult2;
              continue;
            }
            branchResult2 = -1;
            var index3 = branchResult,
              readerResult2;
            var charCode4;
            readerResult2 =
              index3 < chunk.length && ((charCode4 = chunk.charCodeAt(index3)), charCode4 === 47) ? index3 + 1 : -1;
            if (readerResult2 >= index3) {
              index3 = readerResult2;
              var charCode5;
              readerResult2 =
                index3 < chunk.length &&
                ((charCode5 = chunk.charCodeAt(index3)),
                (charCode5 >= 97 && charCode5 <= 122) ||
                  (charCode5 >= 65 && charCode5 <= 90) ||
                  charCode5 === 95 ||
                  charCode5 === 58 ||
                  (charCode5 >= 192 && charCode5 <= 214) ||
                  (charCode5 >= 216 && charCode5 <= 246) ||
                  (charCode5 >= 248 && charCode5 <= 767) ||
                  (charCode5 >= 880 && charCode5 <= 893) ||
                  (charCode5 >= 895 && charCode5 <= 8191) ||
                  (charCode5 >= 8204 && charCode5 <= 8205) ||
                  (charCode5 >= 8304 && charCode5 <= 8591) ||
                  (charCode5 >= 11264 && charCode5 <= 12271) ||
                  (charCode5 >= 12289 && charCode5 <= 55295) ||
                  (charCode5 >= 63744 && charCode5 <= 64975) ||
                  (charCode5 >= 65008 && charCode5 <= 65533) ||
                  (charCode5 >= 65536 && charCode5 <= 983039))
                  ? index3 + 1
                  : -1;
              if (readerResult2 >= index3) {
                index3 = readerResult2;
                readerResult2 = -1;
                var inputLength2 = chunk.length,
                  index4 = index3,
                  charCode6;
                do {
                  if (index4 >= inputLength2) break;
                  charCode6 = chunk.charCodeAt(index4);
                  if (
                    charCode6 === 32 ||
                    charCode6 === 9 ||
                    charCode6 === 13 ||
                    charCode6 === 10 ||
                    charCode6 === 47 ||
                    charCode6 === 62
                  ) {
                    readerResult2 = index4;
                    break;
                  }
                  ++index4;
                } while (true);
                if (readerResult2 < index3) {
                  readerResult2 = chunk.length;
                }
                if (readerResult2 >= index3) {
                  branchResult2 = readerResult2;
                }
              }
            }
            if (branchResult2 > branchResult) {
              if (tokenPending) {
                handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
                tokenPending = false;
              }
              state.stage = stage3;
              state.offset = offset = nextOffset;
              tokenPending = true;
              pendingTokenType = tokenType3;
              stage3 = nextStage(chunk, nextOffset, branchResult2 - nextOffset, context, state);
              nextOffset = branchResult2;
              continue;
            }
            var charCode7;
            branchResult2 =
              branchResult < chunk.length && ((charCode7 = chunk.charCodeAt(branchResult)), charCode7 === 33)
                ? branchResult + 1
                : -1;
            if (branchResult2 > branchResult) {
              var branchResult3;
              branchResult3 = -1;
              var index5 = branchResult2,
                readerResult3;
              readerResult3 =
                index5 + 2 <= chunk.length && chunk.charCodeAt(index5 + 0) === 45 && chunk.charCodeAt(index5 + 1) === 45
                  ? index5 + 2
                  : -1;
              if (readerResult3 >= index5) {
                index5 = readerResult3;
                var index6 = chunk.indexOf(str, index5);
                readerResult3 = index6 === -1 ? -1 : index6 + 3;
                if (readerResult3 < index5) {
                  readerResult3 = chunk.length + 3;
                }
                if (readerResult3 >= index5) {
                  branchResult3 = readerResult3;
                }
              }
              if (branchResult3 > branchResult2) {
                if (tokenPending) {
                  handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
                  tokenPending = false;
                }
                state.stage = stage3;
                state.offset = offset = nextOffset;
                tokenPending = true;
                pendingTokenType = tokenType4;
                nextOffset = branchResult3;
                continue;
              }
              branchResult3 = -1;
              var index7 = branchResult2,
                readerResult4;
              readerResult4 =
                index7 + 7 <= chunk.length &&
                chunk.charCodeAt(index7 + 0) === 91 &&
                chunk.charCodeAt(index7 + 1) === 67 &&
                chunk.charCodeAt(index7 + 2) === 68 &&
                chunk.charCodeAt(index7 + 3) === 65 &&
                chunk.charCodeAt(index7 + 4) === 84 &&
                chunk.charCodeAt(index7 + 5) === 65 &&
                chunk.charCodeAt(index7 + 6) === 91
                  ? index7 + 7
                  : -1;
              if (readerResult4 >= index7) {
                index7 = readerResult4;
                var index8 = chunk.indexOf(str2, index7);
                readerResult4 = index8 === -1 ? -1 : index8 + 3;
                if (readerResult4 < index7) {
                  readerResult4 = chunk.length + 3;
                }
                if (readerResult4 >= index7) {
                  branchResult3 = readerResult4;
                }
              }
              if (branchResult3 > branchResult2) {
                if (tokenPending) {
                  handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
                  tokenPending = false;
                }
                state.stage = stage3;
                state.offset = offset = nextOffset;
                tokenPending = true;
                pendingTokenType = tokenType5;
                nextOffset = branchResult3;
                continue;
              }
              branchResult3 = -1;
              var index9 = branchResult2,
                readerResult5;
              var charCode8;
              readerResult5 =
                index9 + 7 <= chunk.length &&
                ((charCode8 = chunk.charCodeAt(index9 + 0)), charCode8 === 100 || charCode8 === 68) &&
                ((charCode8 = chunk.charCodeAt(index9 + 1)), charCode8 === 111 || charCode8 === 79) &&
                ((charCode8 = chunk.charCodeAt(index9 + 2)), charCode8 === 99 || charCode8 === 67) &&
                ((charCode8 = chunk.charCodeAt(index9 + 3)), charCode8 === 116 || charCode8 === 84) &&
                ((charCode8 = chunk.charCodeAt(index9 + 4)), charCode8 === 121 || charCode8 === 89) &&
                ((charCode8 = chunk.charCodeAt(index9 + 5)), charCode8 === 112 || charCode8 === 80) &&
                ((charCode8 = chunk.charCodeAt(index9 + 6)), charCode8 === 101 || charCode8 === 69)
                  ? index9 + 7
                  : -1;
              if (readerResult5 >= index9) {
                index9 = readerResult5;
                var index10 = chunk.indexOf(str3, index9);
                readerResult5 = index10 === -1 ? -1 : index10 + 1;
                if (readerResult5 < index9) {
                  readerResult5 = chunk.length + 1;
                }
                if (readerResult5 >= index9) {
                  branchResult3 = readerResult5;
                }
              }
              if (branchResult3 > branchResult2) {
                if (tokenPending) {
                  handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
                  tokenPending = false;
                }
                state.stage = stage3;
                state.offset = offset = nextOffset;
                tokenPending = true;
                pendingTokenType = tokenType6;
                nextOffset = branchResult3;
                continue;
              }
              var index11 = chunk.indexOf(str3, branchResult2);
              branchResult3 = index11 === -1 ? -1 : index11 + 1;
              if (branchResult3 < branchResult2) {
                branchResult3 = chunk.length + 1;
              }
              if (branchResult3 > branchResult2) {
                if (tokenPending) {
                  handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
                  tokenPending = false;
                }
                state.stage = stage3;
                state.offset = offset = nextOffset;
                tokenPending = true;
                pendingTokenType = tokenType7;
                nextOffset = branchResult3;
                continue;
              }
            }
            branchResult2 = -1;
            var index12 = branchResult,
              readerResult6;
            var charCode9;
            readerResult6 =
              index12 < chunk.length && ((charCode9 = chunk.charCodeAt(index12)), charCode9 === 63) ? index12 + 1 : -1;
            if (readerResult6 >= index12) {
              index12 = readerResult6;
              var index13 = chunk.indexOf(str4, index12);
              readerResult6 = index13 === -1 ? -1 : index13 + 2;
              if (readerResult6 < index12) {
                readerResult6 = chunk.length + 2;
              }
              if (readerResult6 >= index12) {
                branchResult2 = readerResult6;
              }
            }
            if (branchResult2 > branchResult) {
              if (tokenPending) {
                handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
                tokenPending = false;
              }
              state.stage = stage3;
              state.offset = offset = nextOffset;
              tokenPending = true;
              pendingTokenType = tokenType8;
              nextOffset = branchResult2;
              continue;
            }
          }
          branchResult = -1;
          var index14 = nextOffset,
            readerResult7;
          readerResult7 = index14 + 1 <= chunk.length ? index14 + 1 : -1;
          if (readerResult7 >= index14) {
            index14 = readerResult7;
            var index15 = chunk.indexOf(str5, index14);
            readerResult7 = index15;
            if (readerResult7 < index14) {
              readerResult7 = chunk.length;
            }
            if (readerResult7 >= index14) {
              branchResult = readerResult7;
            }
          }
          if (branchResult > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            tokenPending = true;
            pendingTokenType = tokenType9;
            nextOffset = branchResult;
            continue;
          }
          break;
        case nextStage5:
          var branchResult4;
          branchResult4 = -1;
          var inputLength3 = chunk.length,
            index16 = nextOffset,
            charCode10;
          do {
            if (index16 >= inputLength3) break;
            charCode10 = chunk.charCodeAt(index16);
            if (
              charCode10 === 32 ||
              charCode10 === 9 ||
              charCode10 === 13 ||
              charCode10 === 10 ||
              charCode10 === 47 ||
              charCode10 === 62 ||
              charCode10 === 61
            ) {
              branchResult4 = index16;
              break;
            }
            ++index16;
          } while (true);
          if (branchResult4 < nextOffset) {
            branchResult4 = chunk.length;
          }
          if (branchResult4 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            tokenPending = true;
            pendingTokenType = nextStage6;
            stage3 = nextStage6;
            nextOffset = branchResult4;
            continue;
          }
          var charCode11;
          branchResult4 =
            nextOffset < chunk.length && ((charCode11 = chunk.charCodeAt(nextOffset)), charCode11 === 62)
              ? nextOffset + 1
              : -1;
          if (branchResult4 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            tokenPending = true;
            pendingTokenType = tokenType10;
            stage3 = nextStage2(chunk, nextOffset, branchResult4 - nextOffset, context, state);
            nextOffset = branchResult4;
            continue;
          }
          branchResult4 = -1;
          var index17 = nextOffset,
            readerResult8;
          var charCode12;
          readerResult8 =
            index17 < chunk.length && ((charCode12 = chunk.charCodeAt(index17)), charCode12 === 47) ? index17 + 1 : -1;
          if (readerResult8 >= index17) {
            index17 = readerResult8;
            var charCode13;
            readerResult8 =
              index17 < chunk.length && ((charCode13 = chunk.charCodeAt(index17)), charCode13 === 62)
                ? index17 + 1
                : -1;
            if (readerResult8 >= index17) {
              branchResult4 = readerResult8;
            }
          }
          if (branchResult4 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            tokenPending = true;
            pendingTokenType = tokenType11;
            stage3 = nextStage3(chunk, nextOffset, branchResult4 - nextOffset, context, state);
            nextOffset = branchResult4;
            continue;
          }
          branchResult4 = -1;
          var index18 = nextOffset,
            readerResult9;
          readerResult9 = index18 + 1 <= chunk.length ? index18 + 1 : -1;
          if (readerResult9 >= index18) {
            index18 = readerResult9;
            readerResult9 = index18;
            var readerResult10 = index18;
            do {
              readerResult9 = readerResult10;
              var charCode14;
              readerResult10 =
                readerResult9 < chunk.length &&
                ((charCode14 = chunk.charCodeAt(readerResult9)),
                charCode14 === 32 || charCode14 === 9 || charCode14 === 13 || charCode14 === 10)
                  ? readerResult9 + 1
                  : -1;
            } while (readerResult10 > readerResult9);
            if (readerResult9 >= index18) {
              branchResult4 = readerResult9;
            }
          }
          if (branchResult4 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            nextOffset = branchResult4;
            continue;
          }
          break;
        case nextStage6:
          var branchResult5;
          branchResult5 = -1;
          var inputLength4 = chunk.length,
            index19 = nextOffset,
            charCode15;
          do {
            if (index19 >= inputLength4) break;
            charCode15 = chunk.charCodeAt(index19);
            if (
              charCode15 === 32 ||
              charCode15 === 9 ||
              charCode15 === 13 ||
              charCode15 === 10 ||
              charCode15 === 47 ||
              charCode15 === 62 ||
              charCode15 === 61
            ) {
              branchResult5 = index19;
              break;
            }
            ++index19;
          } while (true);
          if (branchResult5 < nextOffset) {
            branchResult5 = chunk.length;
          }
          if (branchResult5 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            tokenPending = true;
            pendingTokenType = nextStage6;
            stage3 = nextStage6;
            nextOffset = branchResult5;
            continue;
          }
          var charCode16;
          branchResult5 =
            nextOffset < chunk.length && ((charCode16 = chunk.charCodeAt(nextOffset)), charCode16 === 61)
              ? nextOffset + 1
              : -1;
          if (branchResult5 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            stage3 = tokenType;
            nextOffset = branchResult5;
            continue;
          }
          var charCode17;
          branchResult5 =
            nextOffset < chunk.length && ((charCode17 = chunk.charCodeAt(nextOffset)), charCode17 === 62)
              ? nextOffset + 1
              : -1;
          if (branchResult5 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            tokenPending = true;
            pendingTokenType = tokenType10;
            stage3 = nextStage2(chunk, nextOffset, branchResult5 - nextOffset, context, state);
            nextOffset = branchResult5;
            continue;
          }
          branchResult5 = -1;
          var index20 = nextOffset,
            readerResult11;
          var charCode18;
          readerResult11 =
            index20 < chunk.length && ((charCode18 = chunk.charCodeAt(index20)), charCode18 === 47) ? index20 + 1 : -1;
          if (readerResult11 >= index20) {
            index20 = readerResult11;
            var charCode19;
            readerResult11 =
              index20 < chunk.length && ((charCode19 = chunk.charCodeAt(index20)), charCode19 === 62)
                ? index20 + 1
                : -1;
            if (readerResult11 >= index20) {
              branchResult5 = readerResult11;
            }
          }
          if (branchResult5 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            tokenPending = true;
            pendingTokenType = tokenType11;
            stage3 = nextStage3(chunk, nextOffset, branchResult5 - nextOffset, context, state);
            nextOffset = branchResult5;
            continue;
          }
          branchResult5 = -1;
          var index21 = nextOffset,
            readerResult12;
          readerResult12 = index21 + 1 <= chunk.length ? index21 + 1 : -1;
          if (readerResult12 >= index21) {
            index21 = readerResult12;
            readerResult12 = index21;
            var readerResult13 = index21;
            do {
              readerResult12 = readerResult13;
              var charCode20;
              readerResult13 =
                readerResult12 < chunk.length &&
                ((charCode20 = chunk.charCodeAt(readerResult12)),
                charCode20 === 32 || charCode20 === 9 || charCode20 === 13 || charCode20 === 10)
                  ? readerResult12 + 1
                  : -1;
            } while (readerResult13 > readerResult12);
            if (readerResult12 >= index21) {
              branchResult5 = readerResult12;
            }
          }
          if (branchResult5 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            nextOffset = branchResult5;
            continue;
          }
          break;
        case tokenType:
          var branchResult6;
          branchResult6 = -1;
          var index22 = nextOffset,
            readerResult14;
          var charCode21;
          readerResult14 =
            index22 < chunk.length && ((charCode21 = chunk.charCodeAt(index22)), charCode21 === 34) ? index22 + 1 : -1;
          if (readerResult14 >= index22) {
            index22 = readerResult14;
            var index23 = chunk.indexOf(str6, index22);
            readerResult14 = index23 === -1 ? -1 : index23 + 1;
            if (readerResult14 < index22) {
              readerResult14 = chunk.length + 1;
            }
            if (readerResult14 >= index22) {
              branchResult6 = readerResult14;
            }
          }
          if (branchResult6 < nextOffset) {
            branchResult6 = -1;
            var index24 = nextOffset,
              readerResult15;
            var charCode22;
            readerResult15 =
              index24 < chunk.length && ((charCode22 = chunk.charCodeAt(index24)), charCode22 === 39)
                ? index24 + 1
                : -1;
            if (readerResult15 >= index24) {
              index24 = readerResult15;
              var index25 = chunk.indexOf(str7, index24);
              readerResult15 = index25 === -1 ? -1 : index25 + 1;
              if (readerResult15 < index24) {
                readerResult15 = chunk.length + 1;
              }
              if (readerResult15 >= index24) {
                branchResult6 = readerResult15;
              }
            }
          }
          if (branchResult6 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            tokenPending = true;
            pendingTokenType = tokenType;
            stage3 = nextStage5;
            nextOffset = branchResult6;
            continue;
          }
          branchResult6 = -1;
          var inputLength5 = chunk.length,
            index26 = nextOffset,
            charCode23;
          do {
            if (index26 >= inputLength5) break;
            charCode23 = chunk.charCodeAt(index26);
            if (charCode23 === 32 || charCode23 === 9 || charCode23 === 13 || charCode23 === 10 || charCode23 === 62) {
              branchResult6 = index26;
              break;
            }
            ++index26;
          } while (true);
          if (branchResult6 < nextOffset) {
            branchResult6 = chunk.length;
          }
          if (branchResult6 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            tokenPending = true;
            pendingTokenType = tokenType12;
            stage3 = nextStage5;
            nextOffset = branchResult6;
            continue;
          }
          var charCode24;
          branchResult6 =
            nextOffset < chunk.length && ((charCode24 = chunk.charCodeAt(nextOffset)), charCode24 === 62)
              ? nextOffset + 1
              : -1;
          if (branchResult6 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            tokenPending = true;
            pendingTokenType = tokenType10;
            stage3 = nextStage2(chunk, nextOffset, branchResult6 - nextOffset, context, state);
            nextOffset = branchResult6;
            continue;
          }
          branchResult6 = -1;
          var index27 = nextOffset,
            readerResult16;
          var charCode25;
          readerResult16 =
            index27 < chunk.length && ((charCode25 = chunk.charCodeAt(index27)), charCode25 === 47) ? index27 + 1 : -1;
          if (readerResult16 >= index27) {
            index27 = readerResult16;
            var charCode26;
            readerResult16 =
              index27 < chunk.length && ((charCode26 = chunk.charCodeAt(index27)), charCode26 === 62)
                ? index27 + 1
                : -1;
            if (readerResult16 >= index27) {
              branchResult6 = readerResult16;
            }
          }
          if (branchResult6 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            tokenPending = true;
            pendingTokenType = tokenType11;
            stage3 = nextStage3(chunk, nextOffset, branchResult6 - nextOffset, context, state);
            nextOffset = branchResult6;
            continue;
          }
          branchResult6 = -1;
          var index28 = nextOffset,
            readerResult17;
          readerResult17 = index28 + 1 <= chunk.length ? index28 + 1 : -1;
          if (readerResult17 >= index28) {
            index28 = readerResult17;
            readerResult17 = index28;
            var readerResult18 = index28;
            do {
              readerResult17 = readerResult18;
              var charCode27;
              readerResult18 =
                readerResult17 < chunk.length &&
                ((charCode27 = chunk.charCodeAt(readerResult17)),
                charCode27 === 32 || charCode27 === 9 || charCode27 === 13 || charCode27 === 10)
                  ? readerResult17 + 1
                  : -1;
            } while (readerResult18 > readerResult17);
            if (readerResult17 >= index28) {
              branchResult6 = readerResult17;
            }
          }
          if (branchResult6 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            nextOffset = branchResult6;
            continue;
          }
          break;
        case stage:
          var branchResult7;
          branchResult7 = -1;
          var index29 = nextOffset,
            readerResult19;
          var charCode28;
          readerResult19 =
            index29 < chunk.length && ((charCode28 = chunk.charCodeAt(index29)), charCode28 === 60) ? index29 + 1 : -1;
          if (readerResult19 >= index29) {
            index29 = readerResult19;
            var charCode29;
            readerResult19 =
              index29 < chunk.length && ((charCode29 = chunk.charCodeAt(index29)), charCode29 === 47)
                ? index29 + 1
                : -1;
            if (readerResult19 >= index29) {
              index29 = readerResult19;
              var charCode30;
              readerResult19 =
                index29 < chunk.length &&
                ((charCode30 = chunk.charCodeAt(index29)),
                (charCode30 >= 97 && charCode30 <= 122) ||
                  (charCode30 >= 65 && charCode30 <= 90) ||
                  charCode30 === 95 ||
                  charCode30 === 58 ||
                  (charCode30 >= 192 && charCode30 <= 214) ||
                  (charCode30 >= 216 && charCode30 <= 246) ||
                  (charCode30 >= 248 && charCode30 <= 767) ||
                  (charCode30 >= 880 && charCode30 <= 893) ||
                  (charCode30 >= 895 && charCode30 <= 8191) ||
                  (charCode30 >= 8204 && charCode30 <= 8205) ||
                  (charCode30 >= 8304 && charCode30 <= 8591) ||
                  (charCode30 >= 11264 && charCode30 <= 12271) ||
                  (charCode30 >= 12289 && charCode30 <= 55295) ||
                  (charCode30 >= 63744 && charCode30 <= 64975) ||
                  (charCode30 >= 65008 && charCode30 <= 65533) ||
                  (charCode30 >= 65536 && charCode30 <= 983039))
                  ? index29 + 1
                  : -1;
              if (readerResult19 >= index29) {
                index29 = readerResult19;
                readerResult19 = -1;
                var inputLength6 = chunk.length,
                  index30 = index29,
                  charCode31;
                do {
                  if (index30 >= inputLength6) break;
                  charCode31 = chunk.charCodeAt(index30);
                  if (
                    charCode31 === 32 ||
                    charCode31 === 9 ||
                    charCode31 === 13 ||
                    charCode31 === 10 ||
                    charCode31 === 47 ||
                    charCode31 === 62
                  ) {
                    readerResult19 = index30;
                    break;
                  }
                  ++index30;
                } while (true);
                if (readerResult19 < index29) {
                  readerResult19 = chunk.length;
                }
                if (readerResult19 >= index29) {
                  branchResult7 = readerResult19;
                }
              }
            }
          }
          if (branchResult7 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            tokenPending = true;
            pendingTokenType = tokenType3;
            stage3 = nextStage(chunk, nextOffset, branchResult7 - nextOffset, context, state);
            nextOffset = branchResult7;
            continue;
          }
          branchResult7 = -1;
          var index31 = nextOffset,
            readerResult20;
          readerResult20 = index31 + 1 <= chunk.length ? index31 + 1 : -1;
          if (readerResult20 >= index31) {
            index31 = readerResult20;
            var index32 = chunk.indexOf(str5, index31);
            readerResult20 = index32;
            if (readerResult20 < index31) {
              readerResult20 = chunk.length;
            }
            if (readerResult20 >= index31) {
              branchResult7 = readerResult20;
            }
          }
          if (branchResult7 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            tokenPending = true;
            pendingTokenType = tokenType9;
            nextOffset = branchResult7;
            continue;
          }
          break;
        case stage2:
          var branchResult8;
          var index33 = chunk.indexOf(str3, nextOffset);
          branchResult8 = index33 === -1 ? -1 : index33 + 1;
          if (branchResult8 < nextOffset) {
            branchResult8 = chunk.length;
          }
          if (branchResult8 > nextOffset) {
            if (tokenPending) {
              handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
              tokenPending = false;
            }
            state.stage = stage3;
            state.offset = offset = nextOffset;
            tokenPending = true;
            pendingTokenType = tokenType13;
            stage3 = nextStage4;
            nextOffset = branchResult8;
            continue;
          }
          break;
      }
      break;
    }
    if (streaming) return;
    if (tokenPending) {
      handler(pendingTokenType, chunk, offset, nextOffset - offset, context, state);
    }
    state.stage = stage3;
    state.offset = nextOffset;
  };
})();
