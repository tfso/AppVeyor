"use strict";
var assert = require('assert');
var expect = require('expect');
describe('When running tests', function () {
    it('should succeed with assert', function () {
        assert.ok(true, "This shouldn't fail");
    });
    it('should succeed with expect', function () {
        expect(true).toBe(true, "This shouldn't fail");
    });
});
//# sourceMappingURL=when_running_tests.js.map