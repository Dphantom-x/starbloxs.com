import Link from "next/link";
import { Marble, Page } from "@/components/ui";

export default function NotFound() {
  return (
    <Page max={620}>
      <div className="notfound pop-in">
        <Marble size={52} />
        <div className="nf-code mono">404</div>
        <h1 className="nf-title">Lost in the blox</h1>
        <p>
          That page doesn’t exist — it may have been deleted, or never built in
          the first place.
        </p>
        <div className="nf-actions">
          <Link className="btn btn-primary" href="/">
            Back to games
          </Link>
          <Link className="btn btn-chrome" href="/create">
            Create a game
          </Link>
        </div>
      </div>
    </Page>
  );
}
