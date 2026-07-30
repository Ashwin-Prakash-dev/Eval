import { CompassIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <CompassIcon className="h-10 w-10 text-muted-foreground" />
      <div>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
      </div>
      <Button asChild>
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );
}
