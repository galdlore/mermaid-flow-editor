import { Component, type MouseEvent, type ReactNode } from 'react';

export interface ModalErrorBoundaryProps {
  title: string;
  description: string;
  reloadLabel: string;
  closeLabel: string;
  resetKey: string;
  onClose: () => void;
  onReload?: () => void;
  children: ReactNode;
}

interface ModalErrorBoundaryState {
  error: Error | null;
}

/** モーダル描画や動的チャンク読み込みの失敗を捕捉して画面全体の白化を防ぐ ErrorBoundary */
export default class ModalErrorBoundary extends Component<
  ModalErrorBoundaryProps,
  ModalErrorBoundaryState
> {
  state: ModalErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ModalErrorBoundaryState {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  componentDidCatch(error: Error): void {
    console.error('Modal render failed:', error);
  }

  componentDidUpdate(prevProps: ModalErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error !== null) {
      this.setState({ error: null });
    }
  }

  handleClose = (): void => {
    this.setState({ error: null });
    this.props.onClose();
  };

  handleReload = (): void => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    window.location.reload();
  };

  handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) {
      this.handleClose();
    }
  };

  render(): ReactNode {
    const { error } = this.state;
    const { title, description, reloadLabel, closeLabel, children } = this.props;

    if (error !== null) {
      return (
        <div
          className="modal-backdrop"
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
          onMouseDown={this.handleBackdropMouseDown}
        >
          <div className="settings-modal">
            <div className="modal-header">
              <div className="modal-title-group">
                <h2>{title}</h2>
              </div>
            </div>

            <div className="modal-error-body">
              <p className="modal-error-desc">{description}</p>
              {error.message && <pre className="modal-error-detail">{error.message}</pre>}
            </div>

            <div className="settings-modal-footer">
              <button type="button" className="btn-secondary" onClick={this.handleClose}>
                {closeLabel}
              </button>
              <button type="button" className="btn-primary" onClick={this.handleReload}>
                {reloadLabel}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
