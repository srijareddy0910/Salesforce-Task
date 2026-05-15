import { LightningElement, wire, track } from 'lwc';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import OPPORTUNITY_OBJECT from '@salesforce/schema/Opportunity';
import getFieldSetFields from '@salesforce/apex/OpportunityController.getFieldSetFields';
import isAccountPastDue from '@salesforce/apex/OpportunityWarningController.isAccountPastDue';
import { NavigationMixin } from 'lightning/navigation';
import LightningAlert from 'lightning/alert';

export default class OpportunityCreator extends NavigationMixin(LightningElement) {

    @track isRecordTypeStep = true;
    @track isCreateStep = false;
    @track isPastDueAccount = false;

    isSave = false;
    isSaveAndNew = false;

    recordTypeOptions = [];
    recordTypeDevNameMap = {};
    selectedRecordType;
    selectedRecordTypeName;
    fields = [];

    get modalTitle() {
        return this.isRecordTypeStep
            ? 'New Opportunity'
            : `New Opportunity - ${this.selectedRecordTypeName}`;
    }

    @wire(getObjectInfo, { objectApiName: OPPORTUNITY_OBJECT })
    objectInfo({ data }) {
        if (!data) return;

        Object.values(data.recordTypeInfos)
            .filter(rt => rt.available && !rt.master)
            .forEach(rt => {
                this.recordTypeOptions.push({
                    label: rt.name,
                    value: rt.recordTypeId
                });
                this.recordTypeDevNameMap[rt.recordTypeId] = rt.developerName;
            });

        const forcedRtId = new URLSearchParams(window.location.search)
            .get('recordTypeId');

        if (forcedRtId) {
            this.selectedRecordType = forcedRtId;
            this.selectedRecordTypeName =
                this.recordTypeOptions.find(rt => rt.value === forcedRtId)?.label;

            this.isRecordTypeStep = false;
            this.isCreateStep = true;
            this.loadFields();
        }
    }

    handleRecordTypeChange(event) {
        this.selectedRecordType = event.detail.value;
        this.selectedRecordTypeName =
            this.recordTypeOptions.find(rt => rt.value === this.selectedRecordType)?.label;
    }

    loadFields() {
        getFieldSetFields({ recordTypeId: this.selectedRecordType })
            .then(result => {
                this.fields = result;
            });
    }

    handleFieldChange(event) {
        if (event.target.fieldName === 'AccountId') {

            const accountId = event.detail.value;

            if (!accountId) {
                this.isPastDueAccount = false;
                return;
            }

            isAccountPastDue({ accountId })
                .then(result => {
                    this.isPastDueAccount = result === true;
                })
                .catch(() => {
                    this.isPastDueAccount = false;
                });
        }
    }

    handleSaveClick() {
        this.isSave = true;
        this.isSaveAndNew = false;
        this.submitForm();
    }

    handleSaveAndNewClick() {
        this.isSaveAndNew = true;
        this.isSave = false;
        this.submitForm();
    }

    submitForm() {
        this.template
            .querySelector('lightning-record-edit-form')
            .submit();
    }

    async handleSubmit(event) {
        event.preventDefault();

        const fields = event.detail.fields;
        fields.RecordTypeId = this.selectedRecordType;

        const rtDevName =
            this.recordTypeDevNameMap[this.selectedRecordType];

        if (rtDevName === 'RecordType_A') {
            fields.StageName = 'Qualification';

            const today = new Date();
            today.setDate(today.getDate() + 30);
            fields.CloseDate = today.toISOString().split('T')[0];
        }

        // 🔥 Show alert BEFORE save (only once)
        if (this.isPastDueAccount === true) {

            // reset immediately to avoid duplication
            this.isPastDueAccount = false;

            await LightningAlert.open({
                message: 'The Account added on the Opportunity is marked as Past Due.',
                theme: 'warning',
                label: 'Warning'
            });
        }

        this.template
            .querySelector('lightning-record-edit-form')
            .submit(fields);
    }

    handleSuccess(event) {

        // safety reset
        this.isPastDueAccount = false;

        if (this.isSave) {
            this.isSave = false;

            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: event.detail.id,
                    objectApiName: 'Opportunity',
                    actionName: 'view'
                }
            });
            return;
        }

        if (this.isSaveAndNew) {
            this.isSaveAndNew = false;
            this.isCreateStep = false;

            setTimeout(() => {
                this.isCreateStep = true;
            }, 0);
        }
    }

    handleCancel() {
        window.history.back();
    }
}
