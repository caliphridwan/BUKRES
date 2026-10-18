/** Branding is configuration, not code (spec §1, §8). Safe for client use. */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "Faculty of Computing Result Portal",
  institution: process.env.NEXT_PUBLIC_BRAND_INSTITUTION || "Bayero University, Kano",
  logo: process.env.NEXT_PUBLIC_BRAND_LOGO || "",
  official: process.env.NEXT_PUBLIC_OFFICIAL === "true",
  tagline: "Your Academic Journey. Clearly Presented. Securely Accessible.",
};
