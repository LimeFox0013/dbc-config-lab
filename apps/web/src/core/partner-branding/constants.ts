/** Kept to what a launch page shows; the program stores whatever length it is given. */
export const BRANDING_NAME_LIMIT = 32
export const BRANDING_URL_LIMIT = 200

/** Websites are links and logos are images: only https, written or shown. */
export const BRANDING_URL_SCHEME = 'https://'

export enum BrandingRejection {
  NameMissing = 'name-missing',
  NameTooLong = 'name-too-long',
  NameCharacters = 'name-characters',
  WebsiteTooLong = 'website-too-long',
  WebsiteScheme = 'website-scheme',
  LogoTooLong = 'logo-too-long',
  LogoScheme = 'logo-scheme',
}
