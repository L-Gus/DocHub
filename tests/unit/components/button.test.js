import { Button } from '../../../frontend/src/components/ui/button.js';

test('should create button', () => {
  const btn = new Button('Test', () => {});
  expect(btn.render().tagName).toBe('BUTTON');
});
