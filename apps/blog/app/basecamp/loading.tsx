import { Skeleton } from '@hive/ui';

function NewcomerCardSkeleton() {
  return (
    <div className="my-3 flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <Skeleton className="h-16 w-16 shrink-0 rounded-full bg-white/10" />
      <Skeleton className="h-11 w-11 shrink-0 rounded-full bg-white/10" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-32 bg-white/10" />
        <Skeleton className="h-4 w-3/4 bg-white/10" />
      </div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="container mx-auto max-w-screen-2xl flex-grow px-4 pb-2">
      <div className="grid grid-cols-12 md:gap-4">
        <div className="hidden md:col-span-3 md:flex xl:col-span-2">
          <SidebarSkeleton />
        </div>
        <div className="col-span-12 md:col-span-9 xl:col-span-8">
          <div className="col-span-12 mb-5 flex flex-col md:col-span-10 lg:col-span-8">
            <div className="my-4 rounded-2xl bg-[#0B0F17] p-4 ring-1 ring-inset ring-white/10 sm:p-6">
              <Skeleton className="h-7 w-40 bg-white/10" />
              <Skeleton className="mt-4 h-10 w-64 rounded-full bg-white/10" />
              {Array.from({ length: 4 }).map((_, i) => (
                <NewcomerCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
        <div className="hidden xl:col-span-2 xl:flex">
          <SidebarSkeleton />
        </div>
      </div>
    </div>
  );
}
