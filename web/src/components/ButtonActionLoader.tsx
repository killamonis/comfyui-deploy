"use client";

import { LoadingIcon } from "@/components/LoadingIcon";
import { callServerPromise } from "@/components/callServerPromise";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ButtonAction({
  action,
  children,
  ...rest
}: {
  action: () => Promise<any>;
  children: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        if (pending) return;

        setPending(true);
        await callServerPromise(action());
        setPending(false);

        router.refresh();
      }}
      {...rest}
    >
      {children} {pending && <LoadingIcon />}
    </button>
  );
}

export function ButtonActionMenu(props: {
  title?: string;
  actions: {
    title: string;
    action: () => Promise<any>;
  }[];
}) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2" variant="outline" disabled={isLoading}>
          {props.title}
          {isLoading ? <LoadingIcon /> : <MoreVertical size={14} />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {props.actions.map((action) => (
          <DropdownMenuItem
            key={action.title}
            onClick={async () => {
              setIsLoading(true);
              await callServerPromise(action.action());
              setIsLoading(false);
            }}
          >
            {action.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
