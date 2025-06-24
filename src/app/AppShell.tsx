'use client';

import {Burger, Group, NavLink, Skeleton} from "@mantine/core";
import { AppShell } from '@mantine/core';
import {useDisclosure} from "@mantine/hooks";
import Link from "next/link";
import {Suspense, useEffect} from "react";
import {usePathname} from "next/navigation";

function AppShellPanel(props: any) {
	const [opened, {toggle,close}] = useDisclosure();
	const pathname = usePathname();

	useEffect(close, [pathname]);

	return (
		<AppShell
			header={{ height: 60 }}
			navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
			padding="md"
		>
			<AppShell.Header>
				<Group h="100%" px="md">
					<Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
					<h1 className={'text-3xl'}>Admin Panel</h1>
				</Group>
			</AppShell.Header>
			<AppShell.Navbar p="md">
				Navbar

				<NavLink
					component={Link}
					href="/forwarder"
					label="Forwarder"
				/>

				<NavLink
					component={Link}
					href="/watermark"
					label="Watermarks"
				/>
				<NavLink
					component={Link}
					href="/bots"
					label="Bots"
				/>
				<NavLink

					component={Link}
					href="/clone"
					label="Clone Server"
				/>
				<NavLink
					component={Link}
					href="/plan"
					label="Plan Manager"
				/>
				<NavLink
					component={Link}
					href="/backup"
					prefetch={false}
					label="Backup/Restore"
				/>
				<NavLink
					component={Link}
					href="/logs"
					prefetch={false}
					label="Logs"
				/>
			</AppShell.Navbar>
			<AppShell.Main>
					{props.children}
			</AppShell.Main>
		</AppShell>
	);
}

export default AppShellPanel;
