import assert = require('assert');
import expect = require('expect');

describe('When running tests', () => {
    it('should succeed with assert', () => {
        assert.ok(true, "This shouldn't fail");
    });

    it('should succeed with expect', () => {
        expect(true).toBe(true, "This shouldn't fail");
    });
});
