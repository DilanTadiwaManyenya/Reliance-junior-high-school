import { Component, createRef } from 'react'

export default class RouteLoadBoundary extends Component {
  state = { failed: false }
  message = createRef()

  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.message.current?.focus() }

  render() {
    if (this.state.failed) return <section ref={this.message} tabIndex={-1} className="route-loading" role="alert">
      <h1>This page could not open</h1>
      <p>Check your connection, then reload the page to try again.</p>
      <button type="button" className="btn primary" onClick={() => window.location.reload()}>Reload page</button>
    </section>
    return this.props.children
  }
}
