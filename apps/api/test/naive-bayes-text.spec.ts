import { describe, expect, it } from 'vitest';
import { predictNaiveBayes, tokenize, trainNaiveBayes } from '../src/threads/ml/naive-bayes-text';

describe('naive-bayes-text', () => {
  it('tokenize strips short tokens', () => {
    expect(tokenize('Fire in lift! No power')).toContain('fire');
    expect(tokenize('Fire in lift! No power')).not.toContain('in');
  });

  it('predicts matching training text with high confidence', () => {
    const tokens = tokenize('fire smoke gas leak emergency');
    const model = trainNaiveBayes([
      { priority: 'URGENT', tokens },
      { priority: 'NORMAL', tokens: tokenize('suggestion for garden plants') },
      { priority: 'LOW', tokens: tokenize('feedback about newsletter') },
    ]);
    const pred = predictNaiveBayes(model!, tokens);
    expect(pred?.priority).toBe('URGENT');
    expect(pred?.confidence).toBeGreaterThan(0.45);
  });

  it('ranks urgent class highest for emergency vocabulary', () => {
    const model = trainNaiveBayes([
      { priority: 'URGENT', tokens: tokenize('fire smoke gas leak emergency') },
      { priority: 'URGENT', tokens: tokenize('smoke alarm corridor emergency') },
      { priority: 'NORMAL', tokens: tokenize('suggestion for garden plants') },
      { priority: 'LOW', tokens: tokenize('feedback about newsletter') },
    ]);
    const pred = predictNaiveBayes(model!, tokenize('smoke emergency'), 0.2);
    expect(pred?.priority).toBe('URGENT');
  });

  it('returns null when confidence is too low', () => {
    const model = trainNaiveBayes([
      { priority: 'NORMAL', tokens: tokenize('hello world') },
      { priority: 'LOW', tokens: tokenize('hello there') },
    ]);
    const pred = predictNaiveBayes(model!, tokenize('xyz abc'), 0.99);
    expect(pred).toBeNull();
  });
});
