import { EXPERIENCE } from "../experience/experience.js";
import { visualsFor } from "../experience/visualAssets.js";

export function ExperiencePageHeader({
  experience,
  eyebrow,
  title,
  description,
  imageKey = "courses",
  children,
}) {
  const primary = experience === EXPERIENCE.PRIMARY;
  const visuals = visualsFor(experience);

  return (
    <header className={`page-title experience-page-header ${primary ? "primary" : "teen"}`}>
      <div className="experience-page-header-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {children}
      </div>
      <img className="experience-page-header-art" src={visuals[imageKey]} alt="" />
    </header>
  );
}
