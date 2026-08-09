import { EmbedCard } from "./embed-card";
import { decodeEmbedRecipe } from "./embed-core";

export const dynamic = "force-dynamic";

type EmbedPageProps = {
  searchParams: Promise<{ recipe?: string | string[] }>;
};

export default async function EmbedPage({ searchParams }: EmbedPageProps) {
  const params = await searchParams;
  const token = Array.isArray(params.recipe) ? params.recipe[0] : params.recipe;
  const recipe = token ? decodeEmbedRecipe(token) : null;

  return (
    <main className="embed-page">
      {recipe ? (
        <EmbedCard recipe={recipe} />
      ) : (
        <div className="embed-error" role="status">
          <strong>SPECTRA</strong>
          <span>配方链接无效</span>
        </div>
      )}
    </main>
  );
}
