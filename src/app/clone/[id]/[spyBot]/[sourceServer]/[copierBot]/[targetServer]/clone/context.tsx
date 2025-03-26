'use client';


import {getBotChannels} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/action";
import {createContext, useState} from "react";

type ChannelType = (Awaited<ReturnType<typeof getBotChannels>>)[number]
export const defaultClonerContextValue = {
	channels: [] as ChannelType[],
	selectedChannels: [] as unknown as ReturnType<typeof useState<string[]>>,
	selectedRoles: [] as unknown as ReturnType<typeof useState<string[]>>,
	cloneState: [] as unknown as ReturnType<typeof useState<boolean>>,
};


export const ClonerContext = createContext(defaultClonerContextValue)
