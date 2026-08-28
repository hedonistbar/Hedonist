/** The app's wordmark — "HUB" (what people actually call it) stacked over
 * the smaller "Ivchenko" byline. Lives in the boards-screen header. */
export function Logo() {
  return (
    <div className="wordmark">
      <span className="wordmark-hub">HUB</span>
      <span className="wordmark-ivchenko">Ivchenko</span>
    </div>
  );
}
