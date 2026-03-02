export interface UIComponentProps {
  className?: string;
  style?: Record<string, string>;
}

export abstract class UIComponent {
  abstract render(): string;
}
