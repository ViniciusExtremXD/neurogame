import { Component, type ReactNode } from "react";
export class SceneBoundary extends Component<
  {
    children: ReactNode;
    onError: (message: string) => void;
    fallback: ReactNode;
    resetKey?: number | string;
  },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError(
      "Não foi possível abrir o modelo 3D. O atlas de cortes continua disponível.",
    );
  }
  componentDidUpdate(previous: Readonly<{ resetKey?: number | string }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey)
      this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
