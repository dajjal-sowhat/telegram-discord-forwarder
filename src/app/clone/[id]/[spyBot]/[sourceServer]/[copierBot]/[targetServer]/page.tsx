import {ClonerParams} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/cloner";
import SelectFilter from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/SelectFilter";




async function Page(props: any) {
	const params: typeof ClonerParams = await props.params;

	return (
		<div>
			<SelectFilter  />
		</div>
	);
}

export default Page;
