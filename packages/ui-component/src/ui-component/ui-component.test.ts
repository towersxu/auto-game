import { describe, it, expect } from 'vitest';
import { UIComponent } from './ui-component';

describe('UIComponent', () => {
  it('should be an abstract class', () => {
    expect(typeof UIComponent).toBe('function');
  });

  it('should require render method implementation', () => {
    class TestComponent extends UIComponent {
      render(): string {
        return '<div>test</div>';
      }
    }
    
    const component = new TestComponent();
    expect(component.render()).toBe('<div>test</div>');
  });
});
