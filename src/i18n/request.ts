import { getRequestConfig } from "next-intl/server"

// Une seule langue pour l'instant ; l'anglais s'ajoutera via messages/en.json.
export default getRequestConfig(async () => {
  const locale = "fr"
  return {
    locale,
    timeZone: "Africa/Lubumbashi",
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
