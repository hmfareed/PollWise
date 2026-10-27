import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "../components/ui/button";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 space-y-4">
      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">Page Not Found</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        The requested resource or page does not exist or may require different permissions to access.
      </p>
      <Link to="/">
        <Button variant="secondary" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Return to Overview
        </Button>
      </Link>
    </div>
  );
};
