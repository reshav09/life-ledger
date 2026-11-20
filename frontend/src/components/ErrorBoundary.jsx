import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          textAlign: 'center'
        }}>
          <div className="card" style={{ maxWidth: 540, width: '100%', padding: '32px 28px', border: '1px solid var(--rust)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
              Something went wrong loading this ledger
            </h2>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 16 }}>
              An unexpected render error occurred. Your data is safe and intact.
            </p>
            {this.state.error && (
              <pre style={{
                textAlign: 'left',
                fontSize: 11.5,
                background: 'var(--card-hover)',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                overflowX: 'auto',
                color: 'var(--rust)',
                marginBottom: 20,
                maxHeight: 160
              }}>
                {this.state.error.toString()}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={this.handleReset}
                style={{ fontSize: 13 }}
              >
                ↻ Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

