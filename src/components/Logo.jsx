// GUtech wordmark, reproduced as markup (not a raster asset) so it stays
// crisp at any size and can be recolored for dark surfaces. Swap for the
// official SVG/PNG asset by dropping it in src/assets and importing it here
// if a pixel-perfect version of the logo is needed later.
export default function Logo({ size = 'md', tagline = false, mono = false }) {
  return (
    <div className={`gu-logo gu-logo-${size} ${mono ? 'gu-logo-mono' : ''}`}>
      <span className="gu-logo-word">
        <span className="gu-logo-gu">GU</span>
        <span className="gu-logo-tech">tech</span>
      </span>
      {tagline && (
        <span className="gu-logo-tagline">German University of Technology in Oman</span>
      )}
    </div>
  );
}
