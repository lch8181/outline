import type { ColumnSort } from "@tanstack/react-table";
import { observer } from "mobx-react";
import { HistoryIcon } from "outline-icons";
import * as React from "react";
import { Trans, useTranslation } from "react-i18next";
import styled from "styled-components";
import { EventHelper } from "@shared/utils/EventHelper";
import { s } from "@shared/styles";
import type Event from "~/models/Event";
import type Model from "~/models/base/Model";
import { Avatar, AvatarSize } from "~/components/Avatar";
import FilterOptions from "~/components/FilterOptions";
import Heading from "~/components/Heading";
import InputSearch from "~/components/InputSearch";
import Scene from "~/components/Scene";
import Table, { type Column } from "~/components/Table";
import Text from "~/components/Text";
import Time from "~/components/Time";
import { HStack } from "~/components/primitives/HStack";
import useStores from "~/hooks/useStores";
import { useTableRequest } from "~/hooks/useTableRequest";

const ROW_HEIGHT = 50;

const AuditLog = () => {
  const { t } = useTranslation();
  const { events, users } = useStores();
  const [ip, setIp] = React.useState("");
  const [debouncedIp, setDebouncedIp] = React.useState("");
  const [actorId, setActorId] = React.useState("");
  const [eventName, setEventName] = React.useState("");
  const [sort, setSort] = React.useState<ColumnSort>({
    id: "createdAt",
    desc: true,
  });

  React.useEffect(() => {
    void users.fetchAll({ limit: 100 });
  }, [users]);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedIp(ip.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [ip]);

  const reqParams = React.useMemo(
    () => ({
      auditLog: true,
      actorId: actorId || undefined,
      events: eventName ? [eventName] : undefined,
      ip: debouncedIp || undefined,
      sort: sort.id,
      direction: sort.desc ? "DESC" : "ASC",
    }),
    [actorId, eventName, debouncedIp, sort]
  );

  const filteredEvents = React.useMemo(
    () =>
      events.orderedData.filter((event) => {
        if (actorId && event.actorId !== actorId) {
          return false;
        }
        if (eventName && event.name !== eventName) {
          return false;
        }
        if (
          debouncedIp &&
          !event.actorIpAddress
            ?.toLowerCase()
            .includes(debouncedIp.toLowerCase())
        ) {
          return false;
        }

        return EventHelper.AUDIT_EVENTS.includes(
          event.name as (typeof EventHelper.AUDIT_EVENTS)[number]
        );
      }),
    [events.orderedData, actorId, eventName, debouncedIp]
  );

  const { data, loading, next } = useTableRequest({
    data: filteredEvents,
    sort,
    reqFn: events.fetchPage,
    reqParams,
  });

  const userOptions = React.useMemo(
    () => [
      { key: "", label: t("All users") },
      ...users.orderedData
        .filter((user) => !user.isInvited)
        .map((user) => ({
          key: user.id,
          label: user.name,
          icon: <Avatar model={user} size={AvatarSize.Small} />,
        })),
    ],
    [users.orderedData, t]
  );

  const eventOptions = React.useMemo(
    () => [
      { key: "", label: t("All events") },
      ...EventHelper.AUDIT_EVENTS.map((name) => ({
        key: name,
        label: name,
      })),
    ],
    [t]
  );

  const columns = React.useMemo<Column<Event<Model>>[]>(
    () => [
      {
        type: "data",
        id: "actor",
        header: t("Actor"),
        accessor: (event) => event.actor?.name ?? "",
        sortable: false,
        width: "1.5fr",
        component: (event) =>
          event.actor ? (
            <HStack spacing={8}>
              <Avatar model={event.actor} size={AvatarSize.Large} />
              <Text ellipsis>{event.actor.name}</Text>
            </HStack>
          ) : (
            <Text type="tertiary">—</Text>
          ),
      },
      {
        type: "data",
        id: "name",
        header: t("Event"),
        accessor: (event) => event.name,
        sortable: false,
        width: "1.5fr",
        component: (event) => <Code>{event.name}</Code>,
      },
      {
        type: "data",
        id: "description",
        header: t("Description"),
        accessor: (event) => describeEvent(event),
        sortable: false,
        width: "4fr",
        component: (event) => <Text ellipsis>{describeEvent(event)}</Text>,
      },
      {
        type: "data",
        id: "createdAt",
        header: t("Timestamp"),
        accessor: (event) => event.createdAt,
        sortable: true,
        width: "1.2fr",
        component: (event) => (
          <Time dateTime={event.createdAt} relative addSuffix shorten />
        ),
      },
      {
        type: "data",
        id: "source",
        header: t("Source"),
        accessor: (event) => event.authType ?? "",
        sortable: false,
        width: "0.9fr",
        component: (event) => <Text>{event.authType ?? ""}</Text>,
      },
      {
        type: "data",
        id: "ip",
        header: t("IP"),
        accessor: (event) => event.actorIpAddress ?? "",
        sortable: false,
        width: "1.3fr",
        component: (event) =>
          event.actorIpAddress ? (
            <IpLink
              href={"https://ipinfo.io/" + event.actorIpAddress}
              target="_blank"
              rel="noreferrer"
            >
              {event.actorIpAddress}
            </IpLink>
          ) : (
            <Text type="tertiary">—</Text>
          ),
      },
    ],
    [t]
  );

  return (
    <Scene title={t("Audit Log")} icon={<HistoryIcon />} wide>
      <Heading>{t("Audit Log")}</Heading>
      <Text as="p" type="secondary">
        <Trans>
          The audit log details the history of security related and other events
          across your knowledge base.
        </Trans>
      </Text>

      <Filters>
        <IpSearch
          short
          value={ip}
          placeholder={`${t("IP address")}…`}
          onChange={(event) => setIp(event.target.value)}
        />
        <FilterOptions
          options={userOptions}
          selectedKeys={[actorId]}
          onSelect={(key) => setActorId(key ?? "")}
          defaultLabel={t("All users")}
          showFilter
        />
        <FilterOptions
          options={eventOptions}
          selectedKeys={[eventName]}
          onSelect={(key) => setEventName(key ?? "")}
          defaultLabel={t("All events")}
          showFilter
          showIcons={false}
        />
      </Filters>

      <Table
        id="audit-log"
        data={data ?? []}
        columns={columns}
        sort={sort}
        onChangeSort={setSort}
        loading={loading}
        page={{ hasNext: !!next, fetchNext: next }}
        rowHeight={ROW_HEIGHT}
      />
    </Scene>
  );
};

function describeEvent(event: Event<Model>) {
  const data = (event.data ?? {}) as Record<string, unknown>;
  const target =
    (typeof data.name === "string" && data.name) ||
    (typeof data.title === "string" && data.title) ||
    (typeof data.email === "string" && data.email) ||
    "";

  switch (event.name) {
    case "users.signin":
      return event.authType ? "Signed in with " + event.authType : "Signed in";
    case "users.signout":
      return "Signed out";
    case "documents.create":
      return target
        ? "Created the " + target + " document"
        : "Created a document";
    case "documents.update":
    case "revisions.create":
      return target
        ? "Updated the " + target + " document"
        : "Updated a document";
    case "documents.delete":
      return target
        ? "Deleted the " + target + " document"
        : "Deleted a document";
    case "collections.create":
      return target
        ? "Created the " + target + " collection"
        : "Created a collection";
    case "collections.update":
      return target
        ? "Updated the " + target + " collection"
        : "Updated a collection";
    case "collections.delete":
      return target
        ? "Deleted the " + target + " collection"
        : "Deleted a collection";
    case "users.promote":
      return target
        ? "Promoted " + target + "'s role"
        : "Promoted a user's role";
    case "users.demote":
      return target ? "Demoted " + target + "'s role" : "Demoted a user's role";
    case "users.suspend":
      return target
        ? "Suspended " + target + "'s account"
        : "Suspended a user's account";
    case "users.activate":
      return target
        ? "Activated " + target + "'s account"
        : "Activated a user's account";
    default:
      return target || event.name;
  }
}

const Filters = styled(HStack)`
  margin: 16px 0 4px;
  gap: 8px;
  flex-wrap: wrap;
`;

const IpSearch = styled(InputSearch)`
  width: 176px;
`;

const Code = styled.code`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
`;

const IpLink = styled.a`
  color: ${s("link")};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

export default observer(AuditLog);
