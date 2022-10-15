import { toast } from '@zerodevx/svelte-toast';

export const errToast = (m) => {
	toast.pop();

	toast.push(m, {
		theme: {
			'--toastBarBackground': '#DF3C3C'
		}
	});
};
