import { UIComponent, UIComponentProps } from './ui-component';

export interface ButtonProps extends UIComponentProps {
  label: string;
  onClick?: () => void;
}

export class Button extends UIComponent {
  constructor(private props: ButtonProps) {
    super();
  }

  render(): string {
    return `<button class="${this.props.className || ''}">${this.props.label}</button>`;
  }
}
