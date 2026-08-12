import { ComicForm } from "@/components/admin/ComicForm";

export default function NewComicPage() {
  return (
    <div>
      <h1 className="font-display mb-8 text-3xl tracking-wide">
        New comic
      </h1>
      <ComicForm mode="create" />
    </div>
  );
}
