import { useDocs } from "./useLiveDocs";

// A club's cover and 256 px photo (clubs/{id}/media), live. null while missing or not yet loaded.
export function useClubMedia(clubId) {
  const docs = useDocs(clubId ? ["clubs", clubId, "media"] : null);
  const image = (name) => docs.find((d) => d.id === name)?.image || null;
  return { cover: image("cover"), photo: image("photo") };
}
