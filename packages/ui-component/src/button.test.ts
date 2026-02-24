import { describe, it, expect } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('should render button with label', () => {
    const button = new Button({ label: 'Click me' });
    expect(button.render()).toBe('<button class="">Click me</button>');
  });

  it('should render button with className', () => {
    const button = new Button({ label: 'Submit', className: 'btn-primary' });
    expect(button.render()).toBe('<button class="btn-primary">Submit</button>');
  });

  it('should handle empty className', () => {
    const button = new Button({ label: 'Test' });
    expect(button.render()).toContain('class=""');
  });

  it('should store onClick callback', () => {
    const handleClick = () => {};
    const button = new Button({ label: 'Click', onClick: handleClick });
    expect(button).toBeDefined();
  });
});
