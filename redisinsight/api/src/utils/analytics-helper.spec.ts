import {
  calculateRedisHitRatio,
  getJsonPathLevel,
  getRangeForNumber,
} from 'src/utils/analytics-helper';

/* eslint-disable sonarjs/no-duplicate-string */
const getRangeForNumberTests = [
  { input: null, output: undefined },
  { input: undefined, output: undefined },
  { input: 0, output: '0 - 500 000' },
  { input: 100, output: '0 - 500 000' },
  { input: 500000, output: '0 - 500 000' },
  { input: 500001, output: '500 001 - 1 000 000' },
  { input: 600000, output: '500 001 - 1 000 000' },
  { input: 1000000, output: '500 001 - 1 000 000' },
  { input: 1000001, output: '1 000 001 - 10 000 000' },
  { input: 2000000, output: '1 000 001 - 10 000 000' },
  { input: 10000000, output: '1 000 001 - 10 000 000' },
  { input: 10000001, output: '10 000 001 - 50 000 000' },
  { input: 20000000, output: '10 000 001 - 50 000 000' },
  { input: 50000000, output: '10 000 001 - 50 000 000' },
  { input: 50000001, output: '50 000 001 - 100 000 000' },
  { input: 60000000, output: '50 000 001 - 100 000 000' },
  { input: 100000000, output: '50 000 001 - 100 000 000' },
  { input: 100000001, output: '100 000 001 - 1 000 000 000' },
  { input: 200000000, output: '100 000 001 - 1 000 000 000' },
  { input: 1000000000, output: '100 000 001 - 1 000 000 000' },
  { input: 1000000001, output: '1 000 000 001 +' },
  { input: 2000000000, output: '1 000 000 001 +' },
];
/* eslint-enable sonarjs/no-duplicate-string */

const getJsonPathLevelTests = [
  { input: '.', output: 'root' },
  { input: '', output: 'root' },
  { input: '.foo', output: '0' },
  { input: 'foo', output: '0' },
  { input: '.foo["bar"]', output: '1' },
  { input: 'foo["bar"]', output: '1' },
  { input: 'foo[0]["bar"]', output: '2' },
  { input: '[\'foo\']["bar"]', output: '1' },
  { input: '[\'foo\'][0].bar["test"]', output: '3' },
];

const calculateRedisHitRatioTests = [
  { input: { hits: null, misses: null }, output: undefined },
  { input: { hits: undefined, misses: undefined }, output: undefined },
  { input: { hits: 1, misses: undefined }, output: undefined },
  { input: { hits: undefined, misses: 1 }, output: undefined },
  { input: { hits: null, misses: 1 }, output: undefined },
  { input: { hits: 1, misses: null }, output: undefined },
  { input: { hits: NaN, misses: NaN }, output: undefined },
  { input: { hits: NaN, misses: NaN }, output: undefined },
  { input: { hits: NaN, misses: 'string' }, output: undefined },
  { input: { hits: 'string', misses: 'string' }, output: undefined },
  { input: { hits: 2, misses: 2 }, output: 0.5 },
  { input: { hits: 1, misses: 2 }, output: 0.3333333333333333 },
  { input: { hits: 62409, misses: 0 }, output: 1 },
  { input: { hits: 62409, misses: 109669 }, output: 0.3626785527493346 },
  { input: { hits: '62409', misses: '109669' }, output: 0.3626785527493346 },
  { input: { hits: '62409', misses: 109669 }, output: 0.3626785527493346 },
  { input: { hits: '0', misses: 109669 }, output: 1 },
  { input: { hits: 0, misses: 109669 }, output: 1 },
];

describe('getRangeForNumber', () => {
  getRangeForNumberTests.forEach((test) => {
    it(`should be output: ${test.output} for input: ${test.input} `, async () => {
      const result = getRangeForNumber(test.input);

      expect(result).toEqual(test.output);
    });
  });
});

describe('getJsonPathLevel', () => {
  getJsonPathLevelTests.forEach((test) => {
    it(`should be output: ${test.output} for input: ${test.input} `, async () => {
      const result = getJsonPathLevel(test.input);

      expect(result).toEqual(test.output);
    });
  });
});

describe('calculateRedisHitRatio', () => {
  calculateRedisHitRatioTests.forEach((test) => {
    it(`should be output: ${test.output} for input: ${JSON.stringify(
      test.input,
    )} `, async () => {
      const result = calculateRedisHitRatio(test.input.hits, test.input.misses);

      expect(result).toEqual(test.output);
    });
  });
});
