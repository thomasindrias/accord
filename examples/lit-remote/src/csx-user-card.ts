import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("csx-user-card")
export class CsxUserCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: sans-serif;
      border: 1px solid #e2e8f0;
      padding: 16px;
      border-radius: 8px;
    }

    button {
      margin-top: 12px;
    }
  `;

  @property({ type: String })
  userId = "";

  @property({ type: Boolean })
  readonly = false;

  protected createRenderRoot() {
    return this;
  }

  private handleSelect() {
    this.dispatchEvent(
      new CustomEvent("user:selected", {
        detail: { userId: this.userId },
        bubbles: true,
        composed: true
      })
    );
  }

  private handleDelete() {
    this.dispatchEvent(
      new CustomEvent("user:deleted", {
        detail: { userId: this.userId, reason: "manual" },
        bubbles: true,
        composed: true
      })
    );
  }

  render() {
    return html`
      <div>
        <strong>User:</strong> ${this.userId}
        <div>
          <button ?disabled=${this.readonly} @click=${this.handleSelect}>Select</button>
          <button ?disabled=${this.readonly} @click=${this.handleDelete}>Delete</button>
        </div>
      </div>
    `;
  }
}
