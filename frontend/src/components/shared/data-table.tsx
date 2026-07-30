import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string | undefined;
}

export function DataTable<TData>({
  columns,
  data,
  isLoading,
  emptyMessage = "No results found.",
  onRowClick,
  rowClassName,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="w-full overflow-x-auto rounded-lg border scrollbar-thin">
      <table className="w-full caption-bottom text-sm">
        <thead className="border-b bg-muted/40">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="h-10 whitespace-nowrap px-4 text-left align-middle font-medium text-muted-foreground">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b">
                {columns.map((_, j) => (
                  <td key={j} className="p-4">
                    <Skeleton className="h-4 w-full max-w-[160px]" />
                  </td>
                ))}
              </tr>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-10 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={cn(
                  "border-b transition-colors last:border-0 hover:bg-muted/40",
                  onRowClick && "cursor-pointer",
                  rowClassName?.(row.original)
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="whitespace-nowrap p-4 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
