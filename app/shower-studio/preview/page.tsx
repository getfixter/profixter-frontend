import StudioLoader from "../StudioLoader";

/**
 * The owner's live preview of the customer Shower Studio. The server answers
 * only the owner (any other visitor gets nothing); the demo catalog and DEMO
 * prices are fixed, and nothing entered here is saved or sent. noindex comes
 * from the shower-studio layout.
 */
export default function ShowerStudioPreviewPage() {
  return <StudioLoader preview />;
}
