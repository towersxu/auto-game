import { describe, it, expect } from 'vitest';
import * as index from './index';
import { UIComponent } from './ui-component';
import { Button } from './button';

describe('ui-component index', () => {
  it('should export UIComponent class', () => {
    expect(index.UIComponent).toBe(UIComponent);
  });

  it('should export Button class', () => {
    expect(index.Button).toBe(Button);
    const button = new index.Button({ label: 'Test' });
    expect(button).toBeInstanceOf(Button);
  });

  it('should export UIComponentProps interface', () => {
    const props: index.UIComponentProps = {
      className: 'test-class',
      style: { color: 'red' },
    };
    expect(props.className).toBe('test-class');
    expect(props.style).toEqual({ color: 'red' });
  });

  it('should export ButtonProps interface', () => {
    const props: index.ButtonProps = {
      label: 'Click me',
      className: 'btn',
      onClick: () => {},
    };
    expect(props.label).toBe('Click me');
    expect(props.className).toBe('btn');
    expect(typeof props.onClick).toBe('function');
  });

  it('should allow creating Button from index export', () => {
    const button = new index.Button({ label: 'Test Button' });
    expect(button.render()).toBe('<button class="">Test Button</button>');
  });

  it('should allow extending UIComponent from index export', () => {
    class TestComponent extends index.UIComponent {
      render(): string {
        return '<div>test</div>';
      }
    }
    const component = new TestComponent();
    expect(component.render()).toBe('<div>test</div>');
  });
});
