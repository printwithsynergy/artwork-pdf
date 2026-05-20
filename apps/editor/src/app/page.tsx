// SPDX-License-Identifier: AGPL-3.0-or-later
import { EditorApp } from "../components/EditorApp";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const demo = params.demo === "true";
  return <EditorApp demo={demo} />;
}
