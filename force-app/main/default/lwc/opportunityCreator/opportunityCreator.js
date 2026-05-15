import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import OPPORTUNITY_OBJECT from '@salesforce/schema/Opportunity';
import getFieldSetFields from '@salesforce/apex/OpportunityController.getFieldSetFields';
import isAccountPastDue from '@salesforce/apex/OpportunityController.isAccountPastDue';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class OpportunityCreator extends NavigationMixin(LightningElement) {

    @track processedFields = [];
    recordTypeId;
    recordTypeName = '';
    saveAndNew = false;

    get defaultCloseDate() {
        const today = new Date();
        const future = new Date();
        future.setDate(today.getDate() + 30);
        return future.toISOString().split('T')[0];
    }

    @wire(CurrentPageReference)
    getStateParameters(currentPageReference) {
        if (currentPageReference) {
            this.recordTypeId = currentPageReference.state.recordTypeId;
        }
    }

    @wire(getObjectInfo, { objectApiName: OPPORTUNITY_OBJECT })
    objectInfo({ data }) {
        if (data && this.recordTypeId) {

            const rtInfos = data.recordTypeInfos;

            if (rtInfos[this.recordTypeId]) {
                this.recordTypeName = rtInfos[this.recordTypeId].name;
            }

            getFieldSetFields({ recordTypeId: this.recordTypeId })
                .then(result => {
                    this.prepareFields(result);
                });
        }
    }

    prepareFields(fieldList) {

        this.processedFields = fieldList.map(field => {

            let value = null;

            if (field === 'StageName') {
                value = 'Qualification';
            }

            if (field === 'CloseDate') {
                value = this.defaultCloseDate;
            }

            return {
                apiName: field,
                value: value
            };
        });
    }

    handleSubmit(event) {

        event.preventDefault();

        const fields = event.detail.fields;
        const form = this.template.querySelector('lightning-record-edit-form');

        if (!form) return;

        const accountId = fields.AccountId;

        if (!accountId) {
            form.submit(fields);
            return;
        }

        isAccountPastDue({ accountId: accountId })
            .then(result => {

                if (result === true) {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Warning',
                            message: 'This Account is marked as Past Due.',
                            variant: 'warning'
                        })
                    );
                }

                form.submit(fields);
            })
            .catch(() => {
                form.submit(fields);
            });
    }

    handleSaveAndNew() {

    this.saveAndNew = true;

    const form = this.template.querySelector('lightning-record-edit-form');

    if (form) {
        form.submit();
    }
}

    // NEW METHOD ADDED
    handleError() {
        // If validation fails, reset flag
        this.saveAndNew = false;
    }

    handleSuccess(event) {

    const recordId = event.detail.id;

    if (this.saveAndNew) {

        this.saveAndNew = false;
        window.location.reload();

    } else {

        // Navigate to created Opportunity record
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                objectApiName: 'Opportunity',
                actionName: 'view'
            }
        });
    }
}

    handleCancel() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Opportunity',
                actionName: 'list'
            }
        });
    }
}