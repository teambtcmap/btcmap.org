import { toast } from '@zerodevx/svelte-toast';

export const errToast = (m) => {
	toast.pop();

	toast.push(m, {
		theme: {
			'--toastBarBackground': '#DF3C3C'
		}
	});
};

export const warningToast = (m) => {
	toast.pop();

	toast.push(m, {
		theme: {
			'--toastBarBackground': '#FACA15'
		}
	});
};

export const successToast = (m) => {
	toast.pop();

	toast.push(m, {
		theme: {
			'--toastBarBackground': '#22C55E'
		}
	});
};
