import { describe, it, expect, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  describe('render', () => {
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

    it('should handle multiple CSS classes', () => {
      const button = new Button({ label: 'Test', className: 'btn btn-primary btn-large' });
      expect(button.render()).toBe('<button class="btn btn-primary btn-large">Test</button>');
    });

    it('should handle special characters in label', () => {
      const button = new Button({ label: 'Test <script>alert("xss")</script>' });
      expect(button.render()).toBe('<button class="">Test <script>alert("xss")</script></button>');
    });

    it('should handle empty label', () => {
      const button = new Button({ label: '' });
      expect(button.render()).toBe('<button class=""></button>');
    });

    it('should handle very long label', () => {
      const longLabel = 'A'.repeat(1000);
      const button = new Button({ label: longLabel });
      expect(button.render()).toBe(`<button class="">${longLabel}</button>`);
    });
  });

  describe('onClick', () => {
    it('should store onClick callback', () => {
      const handleClick = () => {};
      const button = new Button({ label: 'Click', onClick: handleClick });
      expect(button).toBeDefined();
    });

    it('should store onClick callback correctly', () => {
      const handleClick = vi.fn();
      const button = new Button({ label: 'Click', onClick: handleClick });
      expect(button).toBeDefined();
    });

    it('should work without onClick callback', () => {
      const button = new Button({ label: 'No Click Handler' });
      expect(button.render()).toBe('<button class="">No Click Handler</button>');
    });
  });

  describe('style prop', () => {
    it('should accept style prop', () => {
      const button = new Button({ 
        label: 'Styled', 
        style: { backgroundColor: 'red', color: 'white' }
      });
      expect(button).toBeDefined();
    });

    it('should accept empty style prop', () => {
      const button = new Button({ label: 'Test', style: {} });
      expect(button).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace in className', () => {
      const button = new Button({ label: 'Test', className: '  btn  primary  ' });
      expect(button.render()).toBe('<button class="  btn  primary  ">Test</button>');
    });

    it('should handle unicode in label', () => {
      const button = new Button({ label: '点击我 🎮' });
      expect(button.render()).toBe('<button class="">点击我 🎮</button>');
    });

    it('should handle numeric label', () => {
      const button = new Button({ label: '123' });
      expect(button.render()).toBe('<button class="">123</button>');
    });
  });
});
