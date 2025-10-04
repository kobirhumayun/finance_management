// File: src/app/(admin)/admin/user-management/[userId]/page.js
import { dehydrate } from "@tanstack/react-query";
import HydrateClient from "@/components/HydrateClient";
import { getQueryClient } from "@/app/get-query-client";
import { adminUserProfileOptions, adminUsersOptions } from "@/lib/queries/admin-users";
import { adminPlansOptions } from "@/lib/queries/admin-plans";
import UserProfileClient from "./user-profile-client";

// Server component responsible for prefetching user profile data for hydration.
export default async function AdminUserProfilePage({ params }) {
  const { userId } = await params;
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(adminUserProfileOptions(userId)),
    queryClient.prefetchQuery(adminUsersOptions()),
    queryClient.prefetchQuery(adminPlansOptions()),
  ]);

  const state = dehydrate(queryClient);

  return (
    <HydrateClient state={state}>
      <UserProfileClient userId={userId} />
    </HydrateClient>
  );
}
