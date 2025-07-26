"use client"; // This line MUST be the very first line

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, Auth, User, FirebaseError as AuthFirebaseError } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp, doc, setDoc, getDoc, Firestore, FirebaseError as FirestoreFirebaseError } from 'firebase/firestore';

// Define types for your components' props
interface ModalProps {
  message: string | null;
  onClose: () => void;
}

interface CategoryCardProps {
  title: string;
  icon: string;
  onClick: () => void;
}

// EnergyFormProps: dbInstance is removed as it's not used within this component
interface EnergyFormProps {
  userId: string | null;
  onBack: () => void;
  onFormSubmitted: () => void;
  setModalMessage: (message: string) => void;
}

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void; // Changed 'any' to 'User'
  setModalMessage: (message: string) => void;
  authInstance: Auth; // Changed 'any' to 'Auth'
  dbInstance: Firestore; // Changed 'any' to 'Firestore'
}

interface UtilitiesSubCategoriesScreenProps {
  onBack: () => void;
  onSelectSubCategory: (category: string) => void;
  speakText: (text: string) => void;
}

interface CategoryDetailScreenProps {
  title: string;
  description: string;
  onBack: () => void;
  speakText: (text: string) => void;
}

// === NEW: ToggleSwitch Component Props ===
interface ToggleSwitchProps {
  label: string;
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}


// Define global variables for Canvas environment (these won't be directly used in local build, but kept for compatibility if needed elsewhere)
const appId = 'local-dev-app-id';
const initialAuthToken = null;

// --- IMPORTANT: YOUR "PRECURE MOBILE" FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCRvpNjFsrefUKUIfCfvdIGce8FGiPWpHc",
  authDomain: "precure-mobile-app.firebaseapp.com",
  projectId: "precure-mobile-app",
  storageBucket: "precure-mobile-app.firebasestorage.app",
  messagingSenderId: "64626811146",
  appId: "1:646266811146:web:62315c82c7b1d8559a9af3"
};
// --- END OF FIREBASE CONFIG ---


// === NEW: ToggleSwitch Component ===
const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ label, id, checked, onChange }) => {
  return React.createElement(
    'div',
    { className: 'flex items-center space-x-2' },
    React.createElement('input', {
      type: 'checkbox',
      id: id,
      checked: checked,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked),
      // Tailwind classes for the toggle switch visual
      className: `
        relative peer h-6 w-11 rounded-full shrink-0 bg-gray-300 outline-none transition-all duration-200 ease-in-out
        focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        checked:bg-blue-600
        after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all after:duration-200 after:ease-in-out
        checked:after:translate-x-full
        peer-checked:bg-blue-600
      `,
      role: 'switch', // ARIA role for accessibility
      'aria-checked': checked, // ARIA state for accessibility
      'aria-labelledby': `${id}-label` // Link to visible label
    }),
    React.createElement('label', {
      htmlFor: id,
      id: `${id}-label`, // Actual ID for aria-labelledby
      className: 'text-gray-700 text-sm font-medium cursor-pointer'
    }, label)
  );
};


// Modal Component for custom alerts
const Modal: React.FC<ModalProps> = ({ message, onClose }) => {
  if (!message) return null;

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50' },
    React.createElement(
      'div',
      { className: 'bg-white rounded-lg shadow-xl p-6 max-w-sm w-full text-center' },
      React.createElement('p', { className: 'text-lg font-semibold text-gray-800 mb-4' }, message),
      React.createElement(
        'button',
        {
          onClick: onClose,
          className: 'px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-150 ease-in-out'
        },
        'OK'
      )
    )
  );
};

// Category Card Component
const CategoryCard: React.FC<CategoryCardProps> = ({ title, icon, onClick }) => (
  React.createElement(
    'div',
    {
      className: 'bg-white p-6 rounded-xl shadow-md flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transition duration-200 ease-in-out transform hover:-translate-y-1',
      onClick: onClick
    },
    React.createElement('div', { className: 'text-indigo-600 text-4xl mb-3' }, icon),
    React.createElement('h3', { className: 'text-lg font-semibold text-gray-800' }, title)
  )
);

// Energy Form Component (Full Onboarding Form with Validation)
const EnergyForm: React.FC<EnergyFormProps> = ({ userId, onBack, onFormSubmitted, setModalMessage /* dbInstance removed from here */ }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    companyRegistrationNumber: '',
    businessType: '',
    billingAddress: '',
    siteAddress: '',
    primaryContactName: '',
    contactJobTitle: '',
    emailAddress: '',
    phoneNumber: '',
    electricityMeterNumberMPAN: '',
    gasMeterNumberMPRN: '',
    currentSupplier: '',
    currentContractEndDate: '',
    requestedStartDateWithHaven: '',
    bankAccountName: '',
    sortCode: '',
    accountNumber: '',
    vatStatus: '',
    cclExemption: '',
    authorisedSignatoryName: '',
    dateSigned: '',
    notes: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [siteAddressSameAsBilling, setSiteAddressSameAsBilling] = useState(false);

  const validateField = (name: string, value: string) => {
    let error = '';
    const trimmedValue = value ? String(value).trim() : '';

    const requiredFields = [
      'companyName', 'companyRegistrationNumber', 'businessType', 'billingAddress',
      'primaryContactName', 'contactJobTitle', 'emailAddress', 'phoneNumber',
      'electricityMeterNumberMPAN', 'gasMeterNumberMPRN', 'currentSupplier',
      'currentContractEndDate', 'requestedStartDateWithHaven', 'bankAccountName',
      'sortCode', 'accountNumber', 'vatStatus', 'cclExemption',
      'authorisedSignatoryName', 'dateSigned'
    ];

    if (requiredFields.includes(name) && !trimmedValue && !(name === 'siteAddress' && siteAddressSameAsBilling)) {
      error = `${name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} is required.`;
    }

    if (name === 'emailAddress' && trimmedValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
      error = 'Please enter a valid email address.';
    }
    if (name === 'electricityMeterNumberMPAN' && trimmedValue && !/^\d{21}$/.test(trimmedValue)) {
      error = 'MPAN must be exactly 21 digits.';
    }
    if (name === 'gasMeterNumberMPRN' && trimmedValue && !/^\d{10}$/.test(trimmedValue)) {
      error = 'MPRN must be exactly 10 digits.';
    }
    if (name === 'sortCode' && trimmedValue && !/^(\d{2}-?\d{2}-?\d{2}|\d{6})$/.test(trimmedValue)) {
      error = 'Sort Code must be 6 digits (e.g., 12-34-56 or 123456).';
    }
    if (name === 'accountNumber' && trimmedValue && !/^\d{8}$/.test(trimmedValue)) {
      error = 'Account Number must be exactly 8 digits.';
    }
    if (name === 'vatStatus' && trimmedValue && !/^(5%|20%)$/i.test(trimmedValue)) {
      error = 'VAT Status must be 5% or 20%.';
    }
    if (name === 'cclExemption' && trimmedValue && !/^(yes|no)$/i.test(trimmedValue)) {
      error = 'CCL Exemption must be Yes or No.';
    }
    if ((name === 'currentContractEndDate' || name === 'requestedStartDateWithHaven' || name === 'dateSigned') && trimmedValue && !/^\d{2}\/\d{2}\/\d{4}$/.test(trimmedValue)) {
      error = 'Date must be in DD/MM/YYYY format.';
    }

    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (type === 'checkbox') {
      setSiteAddressSameAsBilling(checked);
      if (checked) {
        setFormData(prevData => ({ ...prevData, siteAddress: prevData.billingAddress }));
        setErrors(prev => ({ ...prev, siteAddress: '' }));
      } else {
        setFormData(prevData => ({ ...prevData, siteAddress: '' }));
      }
    } else {
      setFormData(prevData => ({ ...prevData, [name]: value }));
      validateField(name, value);
    }
  };

  const validateForm = () => {
    let formIsValid = true;
    const newErrors: { [key: string]: string } = {};

    const allFieldsToValidate = { ...formData };
    if (siteAddressSameAsBilling) {
      allFieldsToValidate.siteAddress = formData.billingAddress;
    }

    Object.keys(allFieldsToValidate).forEach(name => {
      const value = allFieldsToValidate[name as keyof typeof allFieldsToValidate]; // Changed 'let' to 'const'
      const trimmedValue = value ? String(value).trim() : '';

      const requiredFields = [
        'companyName', 'companyRegistrationNumber', 'businessType', 'billingAddress',
        'primaryContactName', 'contactJobTitle', 'emailAddress', 'phoneNumber',
        'electricityMeterNumberMPAN', 'gasMeterNumberMPRN', 'currentSupplier',
        'currentContractEndDate', 'requestedStartDateWithHaven', 'bankAccountName',
        'sortCode', 'accountNumber', 'vatStatus', 'cclExemption',
        'authorisedSignatoryName', 'dateSigned'
      ];

      if (requiredFields.includes(name) && !trimmedValue && !(name === 'siteAddress' && siteAddressSameAsBilling)) {
        newErrors[name] = `${name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} is required.`;
        formIsValid = false;
      }

      if (name === 'emailAddress' && trimmedValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
        newErrors[name] = 'Please enter a valid email address.';
        formIsValid = false;
      }
      if (name === 'electricityMeterNumberMPAN' && trimmedValue && !/^\d{21}$/.test(trimmedValue)) {
        newErrors[name] = 'MPAN must be exactly 21 digits.';
        formIsValid = false;
      }
      if (name === 'gasMeterNumberMPRN' && trimmedValue && !/^\d{10}$/.test(trimmedValue)) {
        newErrors[name] = 'MPRN must be exactly 10 digits.';
        formIsValid = false;
      }
      if (name === 'sortCode' && trimmedValue && !/^(\d{2}-?\d{2}-?\d{2}|\d{6})$/.test(trimmedValue)) {
        newErrors[name] = 'Sort Code must be 6 digits (e.g., 12-34-56 or 123456).';
        formIsValid = false;
      }
      if (name === 'accountNumber' && trimmedValue && !/^\d{8}$/.test(trimmedValue)) {
        newErrors[name] = 'Account Number must be exactly 8 digits.';
        formIsValid = false;
      }
      if (name === 'vatStatus' && trimmedValue && !/^(5%|20%)$/i.test(trimmedValue)) {
        newErrors[name] = 'VAT Status must be 5% or 20%.';
        formIsValid = false;
      }
      if (name === 'cclExemption' && trimmedValue && !/^(yes|no)$/i.test(trimmedValue)) {
        newErrors[name] = 'CCL Exemption must be Yes or No.';
        formIsValid = false;
      }
      if ((name === 'currentContractEndDate' || name === 'requestedStartDateWithHaven' || name === 'dateSigned') && trimmedValue && !/^\d{2}\/\d{2}\/\d{4}$/.test(trimmedValue)) {
        newErrors[name] = 'Date must be in DD/MM/YYYY format.';
        formIsValid = false;
      }
    });

    setErrors(newErrors);
    return formIsValid;
  };

  const generateTextFileContent = (data: typeof formData) => {
    const finalSiteAddress = siteAddressSameAsBilling ? data.billingAddress : data.siteAddress;

    return `
New Customer Onboarding Form - Precure Energy

Customer Details:
Company Name: ${data.companyName || 'N/A'}
Company Registration Number: ${data.companyRegistrationNumber || 'N/A'}
Business Type (e.g., Ltd, Sole Trader): ${data.businessType || 'N/A'}
Billing Address: ${data.billingAddress || 'N/A'}
Site Address (if different): ${finalSiteAddress || 'N/A'}

Contact Information:
Primary Contact Name: ${data.primaryContactName || 'N/A'}
Contact Job Title: ${data.contactJobTitle || 'N/A'}
Email Address: ${data.emailAddress || 'N/A'}
Phone Number: ${data.phoneNumber || 'N/A'}

Supply Information:
Electricity Meter Number (MPAN): ${data.electricityMeterNumberMPAN || 'N/A'}
Gas Meter Number (MPRN): ${data.gasMeterNumberMPRN || 'N/A'}
Current Supplier: ${data.currentSupplier || 'N/A'}
Current Contract End Date: ${data.currentContractEndDate || 'N/A'}
Requested Start Date with Precure: ${data.requestedStartDateWithHaven || 'N/A'}

Financial Details:
Bank Account Name: ${data.bankAccountName || 'N/A'}
Sort Code: ${data.sortCode || 'N/A'}
Account Number: ${data.accountNumber || 'N/A'}
VAT Status (5% or 20%): ${data.vatStatus || 'N/A'}
CCL Exemption (Yes/No): ${data.cclExemption || 'N/A'}

Authorisation:
Authorised Signatory Name: ${data.authorisedSignatoryName || 'N/A'}
Date Signed: ${data.dateSigned || 'N/A'}

Additional Notes:
${data.notes || 'N/A'}

Submitted by User ID: ${userId}
Submission Date: ${new Date().toLocaleString()}
    `.trim();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) {
      setModalMessage("Please correct the errors in the form before submitting.");
      return;
    }

    setIsLoading(true);
    try {
      const fileContent = generateTextFileContent(formData);
      const filename = `${formData.companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.txt`;

      console.log("Simulating form submission with data:", formData);
      console.log("Generated file content for bot:", fileContent);
      console.log("Simulated filename:", filename);
      console.log("Submitted by User ID:", userId);

      await new Promise(resolve => setTimeout(resolve, 2000));

      setModalMessage("Form submitted successfully! (Simulated to Dropbox)");
      setFormData({
        companyName: '', companyRegistrationNumber: '', businessType: '', billingAddress: '', siteAddress: '',
        primaryContactName: '', contactJobTitle: '', emailAddress: '', phoneNumber: '',
        electricityMeterNumberMPAN: '', gasMeterNumberMPRN: '', currentSupplier: '',
        currentContractEndDate: '', requestedStartDateWithHaven: '', bankAccountName: '',
        sortCode: '', accountNumber: '', vatStatus: '', cclExemption: '',
        authorisedSignatoryName: '', dateSigned: '', notes: ''
      });
      setErrors({});
      setSiteAddressSameAsBilling(false);
      onFormSubmitted();
    } catch (error: any) {
      console.error("Error during simulated submission: ", error);
      setModalMessage(`Error submitting form: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const hasErrors = Object.values(errors).some(error => error !== '');

  return React.createElement(
    'div',
    { className: 'p-6 bg-gray-50 min-h-screen flex flex-col items-center' },
    React.createElement(
      'div',
      { className: 'w-full max-w-2xl bg-white p-6 rounded-xl shadow-md' },
      React.createElement(
        'button',
        {
          onClick: onBack,
          className: 'self-start mb-6 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition duration-150 ease-in-out flex items-center'
        },
        React.createElement('svg', { className: 'w-4 h-4 mr-2', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
          React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M10 19l-7-7m0 0l7-7m-7 7h18' })
        ),
        'Back'
      ),
      React.createElement('h2', { className: 'text-3xl font-bold text-indigo-800 mb-8 text-center' }, 'New Customer Onboarding Form'),
      React.createElement(
        'form',
        { onSubmit: handleSubmit, className: 'space-y-6' },
        React.createElement(
          'div',
          { className: 'border-b border-gray-200 pb-4' },
          React.createElement('h3', { className: 'text-xl font-semibold text-gray-700 mb-4' }, 'Customer Details'),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'companyName', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Company Name'),
            React.createElement('input', {
              type: 'text', id: 'companyName', name: 'companyName', value: formData.companyName, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.companyName ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: 'e.g., ABC Solutions Ltd.', required: true
            }),
            errors.companyName && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.companyName)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'companyRegistrationNumber', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Company Registration Number'),
            React.createElement('input', {
              type: 'text',
              id: 'companyRegistrationNumber',
              name: 'companyRegistrationNumber',
              value: formData.companyRegistrationNumber,
              onChange: handleChange,
              onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.companyRegistrationNumber ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., 12345678",
              required: true
            }),
            errors.companyRegistrationNumber && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.companyRegistrationNumber)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'businessType', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Business Type (e.g., Ltd, Sole Trader)'),
            React.createElement('input', {
              type: 'text',
              id: 'businessType',
              name: 'businessType',
              value: formData.businessType,
              onChange: handleChange,
              onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.businessType ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., Limited Company",
              required: true
            }),
            errors.businessType && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.businessType)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'billingAddress', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Billing Address'),
            React.createElement('textarea', {
              id: 'billingAddress', name: 'billingAddress', value: formData.billingAddress, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              rows: '3', className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.billingAddress ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "123 Main St, City, Postcode", required: true
            }),
            errors.billingAddress && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.billingAddress)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'siteAddress', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Site Address (if different)'),
            React.createElement('div', { className: 'flex items-center mb-2' },
              React.createElement('input', {
                type: 'checkbox', id: 'siteAddressSameAsBilling', name: 'siteAddressSameAsBilling', checked: siteAddressSameAsBilling, onChange: handleChange,
                className: 'mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded'
              }),
              React.createElement('label', { htmlFor: 'siteAddressSameAsBilling', className: 'text-gray-700 text-sm' }, 'Same as Billing Address')
            ),
            React.createElement('textarea', {
              id: 'siteAddress', name: 'siteAddress', value: siteAddressSameAsBilling ? formData.billingAddress : formData.siteAddress, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              rows: '3', className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.siteAddress ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "Enter site address if different", disabled: siteAddressSameAsBilling
            }),
            errors.siteAddress && !siteAddressSameAsBilling && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.siteAddress)
          )
        ),

        React.createElement(
          'div',
          { className: 'border-b border-gray-200 pb-4' },
          React.createElement('h3', { className: 'text-xl font-semibold text-gray-700 mb-4' }, 'Contact Information'),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'primaryContactName', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Primary Contact Name'),
            React.createElement('input', {
              type: 'text', id: 'primaryContactName', name: 'primaryContactName', value: formData.primaryContactName, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.primaryContactName ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., John Doe", required: true
            }),
            errors.primaryContactName && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.primaryContactName)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'contactJobTitle', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Contact Job Title'),
            React.createElement('input', {
              type: 'text', id: 'contactJobTitle', name: 'contactJobTitle', value: formData.contactJobTitle, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.contactJobTitle ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., Project Manager", required: true
            }),
            errors.contactJobTitle && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.contactJobTitle)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'emailAddress', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Email Address'),
            React.createElement('input', {
              type: 'email', id: 'emailAddress', name: 'emailAddress', value: formData.emailAddress, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.emailAddress ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., john.doe@example.com", required: true
            }),
            errors.emailAddress && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.emailAddress)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'phoneNumber', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Phone Number'),
            React.createElement('input', {
              type: 'tel', id: 'phoneNumber', name: 'phoneNumber', value: formData.phoneNumber, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.phoneNumber ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., 07123456789", required: true
            }),
            errors.phoneNumber && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.phoneNumber)
          )
        ),

        React.createElement(
          'div',
          { className: 'border-b border-gray-200 pb-4' },
          React.createElement('h3', { className: 'text-xl font-semibold text-gray-700 mb-4' }, 'Supply Information'),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'electricityMeterNumberMPAN', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Electricity Meter Number (MPAN)'),
            React.createElement('input', {
              type: 'text', id: 'electricityMeterNumberMPAN', name: 'electricityMeterNumberMPAN', value: formData.electricityMeterNumberMPAN, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.electricityMeterNumberMPAN ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., 012345678901234567890", maxLength: '21', required: true
            }),
            errors.electricityMeterNumberMPAN && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.electricityMeterNumberMPAN)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'gasMeterNumberMPRN', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Gas Meter Number (MPRN)'),
            React.createElement('input', {
              type: 'text', id: 'gasMeterNumberMPRN', name: 'gasMeterNumberMPRN', value: formData.gasMeterNumberMPRN, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.gasMeterNumberMPRN ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., 1234567890", maxLength: '10', required: true
            }),
            errors.gasMeterNumberMPRN && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.gasMeterNumberMPRN)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'currentSupplier', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Current Supplier'),
            React.createElement('input', {
              type: 'text', id: 'currentSupplier', name: 'currentSupplier', value: formData.currentSupplier, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.currentSupplier ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., British Gas", required: true
            }),
            errors.currentSupplier && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.currentSupplier)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'currentContractEndDate', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Current Contract End Date (DD/MM/YYYY)'),
            React.createElement('input', {
              type: 'text', id: 'currentContractEndDate', name: 'currentContractEndDate', value: formData.currentContractEndDate, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.currentContractEndDate ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., 31/07/2025", required: true
            }),
            errors.currentContractEndDate && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.currentContractEndDate)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'requestedStartDateWithHaven', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Requested Start Date with Precure (DD/MM/YYYY)'),
            React.createElement('input', {
              type: 'text', id: 'requestedStartDateWithHaven', name: 'requestedStartDateWithHaven', value: formData.requestedStartDateWithHaven, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.requestedStartDateWithHaven ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., 01/08/2025", required: true
            }),
            errors.requestedStartDateWithHaven && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.requestedStartDateWithHaven)
          )
        ),

        React.createElement(
          'div',
          { className: 'border-b border-gray-200 pb-4' },
          React.createElement('h3', { className: 'text-xl font-semibold text-gray-700 mb-4' }, 'Financial Details'),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'bankAccountName', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Bank Account Name'),
            React.createElement('input', {
              type: 'text', id: 'bankAccountName', name: 'bankAccountName', value: formData.bankAccountName, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.bankAccountName ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., Barry White", required: true
            }),
            errors.bankAccountName && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.bankAccountName)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'sortCode', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Sort Code (e.g., 50-26-65 or 502665)'),
            React.createElement('input', {
              type: 'text', id: 'sortCode', name: 'sortCode', value: formData.sortCode, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.sortCode ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., 50-26-65", maxLength: '8', required: true
            }),
            errors.sortCode && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.sortCode)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'accountNumber', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Account Number (8 digits)'),
            React.createElement('input', {
              type: 'text', id: 'accountNumber', name: 'accountNumber', value: formData.accountNumber, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.accountNumber ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., 25678942", maxLength: '8', required: true
            }),
            errors.accountNumber && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.accountNumber)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'vatStatus', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'VAT Status (5% or 20%)'),
            React.createElement('input', {
              type: 'text', id: 'vatStatus', name: 'vatStatus', value: formData.vatStatus, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.vatStatus ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., 20%", required: true
            }),
            errors.vatStatus && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.vatStatus)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'cclExemption', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'CCL Exemption (Yes/No)'),
            React.createElement('input', {
              type: 'text', id: 'cclExemption', name: 'cclExemption', value: formData.cclExemption, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.cclExemption ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., No", required: true
            }),
            errors.cclExemption && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.cclExemption)
          )
        )
        ,

        React.createElement(
          'div',
          { className: 'border-b border-gray-200 pb-4' },
          React.createElement('h3', { className: 'text-xl font-semibold text-gray-700 mb-4' }, 'Authorisation'),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'authorisedSignatoryName', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Authorised Signatory Name'),
            React.createElement('input', {
              type: 'text', id: 'authorisedSignatoryName', name: 'authorisedSignatoryName', value: formData.authorisedSignatoryName, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.authorisedSignatoryName ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., Barry White", required: true
            }),
            errors.authorisedSignatoryName && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.authorisedSignatoryName)
          ),
          React.createElement('div', null,
            React.createElement('label', { htmlFor: 'dateSigned', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Date Signed (DD/MM/YYYY)'),
            React.createElement('input', {
              type: 'text', id: 'dateSigned', name: 'dateSigned', value: formData.dateSigned, onChange: handleChange, onBlur: (e) => validateField(e.target.name, e.target.value),
              className: `shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${errors.dateSigned ? 'border-red-500 focus:ring-red-500' : 'focus:ring-indigo-500 focus:border-transparent'} transition duration-150 ease-in-out`,
              placeholder: "e.g., 11/07/2025", required: true
            }),
            errors.dateSigned && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.dateSigned)
          )
        ),

        React.createElement('div', null,
          React.createElement('label', { htmlFor: 'notes', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Additional Notes (Optional)'),
          React.createElement('textarea', {
            id: 'notes', name: 'notes', value: formData.notes, onChange: handleChange,
            rows: '4', className: 'shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-150 ease-in-out',
            placeholder: 'Any specific instructions or details for Precure...'
          })
        ),

        React.createElement(
          'button',
          {
            type: 'submit',
            className: 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-150 ease-in-out',
            disabled: isLoading || hasErrors
          },
          isLoading ? 'Submitting...' : 'Submit'
        )
      )
    )
  );
};

// Utilities Sub-Categories Screen
const UtilitiesSubCategoriesScreen: React.FC<UtilitiesSubCategoriesScreenProps> = ({ onBack, onSelectSubCategory, speakText }) => {
  const [hasSpoken, setHasSpoken] = useState(false);
  const storyText = `At Precure, we understand that managing business utilities can be complex and time-consuming. That's why we leverage our extensive industry expertise and collective buying power to secure the most competitive energy deals for our customers. Our intelligent system continuously monitors the market, identifying optimal tariffs and ensuring you benefit from cost savings without compromising on service. With Precure, you gain a strategic partner dedicated to optimizing your utility expenses, allowing you to focus on what truly matters: growing your business.`;

  useEffect(() => {
    if (!hasSpoken && speakText) {
      speakText(storyText);
      setHasSpoken(true);
    }
  }, [hasSpoken, speakText, storyText]);

  return React.createElement(
    'div',
    { className: 'p-6 bg-gray-50 min-h-screen flex flex-col items-center' },
    React.createElement(
      'div',
      { className: 'w-full max-w-2xl' },
      React.createElement(
        'button',
        {
          onClick: onBack,
          className: 'self-start mb-6 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition duration-150 ease-in-out flex items-center'
        },
        React.createElement('svg', { className: 'w-4 h-4 mr-2', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
          React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M10 19l-7-7m0 0l7-7m-7 7h18' })
        ),
        'Back to Categories'
      ),
      React.createElement('h2', { className: 'text-3xl font-bold text-indigo-800 mb-6 text-center' }, 'Utilities Services'),
      React.createElement(
        'div',
        { className: 'bg-white p-6 rounded-xl shadow-md mb-8 text-gray-700 leading-relaxed' },
        React.createElement('p', { className: 'mb-4' },
          'At Precure, we understand that managing business utilities can be complex and time-consuming. That\'s why we leverage our extensive industry expertise and collective buying power to secure the most competitive energy deals for our customers.'
        ),
        React.createElement('p', null,
          'Our intelligent system continuously monitors the market, identifying optimal tariffs and ensuring you benefit from cost savings without compromising on service. With Precure, you gain a strategic partner dedicated to optimizing your utility expenses, allowing you to focus on what truly matters: growing your business.'
        )
      ),
      React.createElement(
        'div',
        { className: 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3' },
        React.createElement(CategoryCard, { title: 'Energy (Precure)', icon: '⚡', onClick: () => onSelectSubCategory('Energy (Precure)') }),
        React.createElement(CategoryCard, { title: 'Water Management', icon: '💧', onClick: () => onSelectSubCategory('Water Management') }),
        React.createElement(CategoryCard, { title: 'Waste Solutions', icon: '♻️', onClick: () => onSelectSubCategory('Waste Solutions') })
      )
    )
  );
};


// Category Detail Screen Component
const CategoryDetailScreen: React.FC<CategoryDetailScreenProps> = ({ title, description, onBack, speakText }) => {
  const [hasSpoken, setHasSpoken] = useState(false);

  useEffect(() => {
    if (!hasSpoken && speakText) {
      speakText(description);
      setHasSpoken(true);
    }
  }, [hasSpoken, speakText, description]);

  return React.createElement(
    'div',
    { className: 'p-6 bg-gray-50 min-h-screen flex flex-col' },
    React.createElement(
      'button',
      {
        onClick: onBack,
        className: 'self-start mb-6 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition duration-150 ease-in-out flex items-center'
      },
      React.createElement('svg', { className: 'w-4 h-4 mr-2', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M10 19l-7-7m0 0l7-7m-7 7h18' })
      ),
      'Back'
    ),
    React.createElement('h2', { className: 'text-3xl font-bold text-indigo-800 mb-6 text-center' }, title, ' Benefits'),
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-xl shadow-md flex-grow text-gray-700 leading-relaxed' },
      React.createElement('p', { className: 'mb-4' }, description),
      React.createElement('p', { className: 'font-semibold' }, 'Simply fill out the forms within this section to experience seamless operations with Precure!')
    )
  );
};

// Auth Screen Component for Login/Signup
const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess, setModalMessage, authInstance, dbInstance }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      console.log("Attempting authentication...");
      if (!authInstance) {
        console.error("Firebase Auth object is null or undefined. Firebase config might be missing.");
        setModalMessage("Firebase is not configured. Please provide your Firebase project details in the code.");
        return;
      }

      let userCredential;
      if (isLogin) {
        console.log("Attempting login with email:", email);
        userCredential = await signInWithEmailAndPassword(authInstance, email, password);
      } else {
        console.log("Attempting signup with email:", email, "and display name:", displayName);
        userCredential = await createUserWithEmailAndPassword(authInstance, email, password);
        if (userCredential.user) {
          const userDocRef = doc(dbInstance, `artifacts/${appId}/users/${userCredential.user.uid}`);
          await setDoc(userDocRef, {
            email: email,
            displayName: displayName,
            createdAt: serverTimestamp()
          });
          console.log("User display name stored in Firestore.");
        }
      }
      console.log("Authentication successful. User credential:", userCredential);
      onAuthSuccess(userCredential.user);
    } catch (error: any) {
      console.error("Authentication error caught in handleAuth:", error);
      setModalMessage(`Authentication failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return React.createElement(
    'div',
    { className: 'p-6 bg-gradient-to-br from-cyan-100 to-blue-300 min-h-screen flex flex-col items-center justify-center' },
    React.createElement(
      'div',
      { className: 'w-full max-w-md bg-white p-8 rounded-xl shadow-lg' },
      React.createElement('h2', { className: 'text-3xl font-bold text-indigo-800 mb-6 text-center' },
        isLogin ? 'Login' : 'Sign Up', ' to Precure'
      ),
      React.createElement(
        'form',
        { onSubmit: handleAuth },
        !isLogin && React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement('label', { htmlFor: 'displayName', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'User Name'),
          React.createElement('input', {
            type: 'text', id: 'displayName', value: displayName, onChange: (e) => setDisplayName(e.target.value),
            className: 'shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-150 ease-in-out',
            placeholder: 'Your display name', required: !isLogin
          })
        ),
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement('label', { htmlFor: 'email', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Email'),
          React.createElement('input', {
            type: 'email', id: 'email', value: email, onChange: (e) => setEmail(e.target.value),
            className: 'shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-150 ease-in-out',
            placeholder: 'your@example.com', required: true
          })
        ),
        React.createElement(
          'div',
          { className: 'mb-6' },
          React.createElement('label', { htmlFor: 'password', className: 'block text-gray-700 text-sm font-semibold mb-2' }, 'Password'),
          React.createElement(
            'div',
            { className: 'relative' },
            React.createElement('input', {
              type: showPassword ? 'text' : 'password', id: 'password', value: password, onChange: (e) => setPassword(e.target.value),
              className: 'shadow-sm appearance-none border rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-150 ease-in-out pr-10',
              placeholder: '********', required: true
            }),
            React.createElement(
              'button',
              {
                type: 'button', onClick: () => setShowPassword(!showPassword),
                className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none',
                'aria-label': showPassword ? 'Hide password' : 'Show password'
              },
              showPassword ? (
                React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'feather feather-eye-off' },
                  React.createElement('path', { d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.54 18.54 0 0 1 2.54-3.39M2 2l20 20M9.91 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.54 18.54 0 0 1-2.54 3.39' }),
                  React.createElement('path', { d: 'M15 14.5a3 3 0 1 0-5.5-1.5' })
                )
              ) : (
                React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'feather feather-eye' },
                  React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }),
                  React.createElement('circle', { cx: '12', cy: '12', r: '3' })
                )
              )
            )
          )
        ),
        React.createElement(
          'button',
          {
            type: 'submit',
            className: 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-150 ease-in-out',
            disabled: isLoading
          },
          isLoading ? (isLogin ? 'Logging In...' : 'Signing Up...') : (isLogin ? 'Login' : 'Sign Up')
        )
      ),
      React.createElement('p', { className: 'text-center text-gray-600 text-sm mt-6' },
        isLogin ? 'Don\'t have an account?' : 'Already have an account?', ' ',
        React.createElement(
          'button',
          {
            onClick: () => setIsLogin(!isLogin),
            className: 'text-indigo-600 hover:text-indigo-800 font-semibold focus:outline-none'
          },
          isLogin ? 'Sign Up' : 'Login'
        )
      )
    )
  );
};


// Main App Component
const App: React.FC = () => { // Add React.FC to the App component
  const [currentPage, setCurrentPage] = useState('auth');
  const [user, setUser] = useState<any>(null); // Use a more specific type if possible for user
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [hasSpokenIntro, setHasSpokenIntro] = useState(false);
  // === NEW: State for voice enabled/disabled ===
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true); // Default to on

  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const firebaseAppRef = useRef<any>(null);
  const authRef = useRef<any>(null);
  const dbRef = useRef<any>(null);

  // Effect to initialize Firebase once
  useEffect(() => {
    try {
      if (!firebaseAppRef.current) {
        if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
          firebaseAppRef.current = initializeApp(firebaseConfig);
          authRef.current = getAuth(firebaseAppRef.current);
          dbRef.current = getFirestore(firebaseAppRef.current);
          console.log("Firebase initialized successfully with Precure Mobile config.");
          console.log("Firebase Config Used:", firebaseConfig);
        } else {
          console.warn("Firebase not initialized: Please update firebaseConfig with your 'Precure Mobile' project details.");
        }
      }
    } catch (error) {
      console.error("Error initializing Firebase:", error);
    }
  }, []);

  // Effect to load voices once and select female voice
  useEffect(() => {
    const loadAndSelectVoice = async () => {
      const getVoicesPromise = () => {
        return new Promise(resolve => {
          let voices = window.speechSynthesis.getVoices();
          if (voices.length) {
            resolve(voices);
          } else {
            window.speechSynthesis.onvoiceschanged = () => {
              voices = window.speechSynthesis.getVoices();
              resolve(voices);
            };
          }
        });
      };

      const voices = await getVoicesPromise();
      let voiceToUse = null;

      // Prioritize Google UK English Female
      voiceToUse = voices.find(voice => voice.lang === 'en-GB' && voice.name.includes('Google UK English Female'));

      // Fallback to any English female voice
      if (!voiceToUse) {
        voiceToUse = voices.find(voice => voice.lang.startsWith('en-') && voice.name.includes('Female'));
      }

      // Fallback to any voice explicitly marked as female (less common but good to check)
      if (!voiceToUse) {
        voiceToUse = voices.find(voice => voice.gender === 'female');
      }

      // FALLBACK TO ANY AVAILABLE VOICE if no specific female voice is found
      if (!voiceToUse && voices.length > 0) {
          voiceToUse = voices[0];
          console.warn("No preferred female voice found. Using the first available voice:", voiceToUse.name);
      }


      if (voiceToUse) {
        setSelectedVoice(voiceToUse);
      } else {
        console.warn("No suitable voice found. Speech will be silent.");
      }
    };

    loadAndSelectVoice();
  }, []);

  // speakText utility function, made useCallback to be stable for useEffect dependencies
  const speakText = useCallback((text: string) => {
    // Only speak if voice is enabled AND selectedVoice is available
    if (isVoiceEnabled && selectedVoice) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      utterance.voice = selectedVoice;
      window.speechSynthesis.speak(utterance);
    } else if (!isVoiceEnabled) {
        console.log("Voice output is currently disabled by user preference.");
    } else {
        console.warn("Cannot speak: No selected voice available or voice not enabled.");
    }
  }, [selectedVoice, isVoiceEnabled]); // isVoiceEnabled added to dependencies


  // Effect for auth state changes and initial setup
  useEffect(() => {
    const setupAuth = () => {
      if (!authRef.current || !dbRef.current) {
        setModalMessage("Firebase is not initialized. Please ensure your 'Precure Mobile' Firebase config is correctly pasted in the code.");
        setIsAuthReady(true);
        return;
      }

      const unsubscribe = onAuthStateChanged(authRef.current, async (currentUser: any) => {
        if (currentUser) {
          setUser(currentUser);
          console.log("User authenticated:", currentUser.uid);

          if (!currentUser.displayName) {
            try {
              const userDocRef = doc(dbRef.current, `artifacts/${appId}/users/${currentUser.uid}`);
              const docSnap = await getDoc(userDocRef);
              if (docSnap.exists() && docSnap.data().displayName) {
                setUser(prevUser => ({ ...prevUser, displayName: docSnap.data().displayName }));
              }
            } catch (error) {
              console.error("Error fetching display name from Firestore:", error);
            }
          }
          setCurrentPage('home');
        } else {
          console.log("No user signed in.");
          setUser(null);
          setCurrentPage('auth');
        }
        setIsAuthReady(true);
      });

      if (initialAuthToken && !authRef.current.currentUser) {
        try {
          signInWithCustomToken(authRef.current, initialAuthToken)
            .catch((tokenError: any) => console.warn("Custom token sign-in failed:", tokenError));
        } catch (e: any) {
          console.warn("Error attempting custom token sign-in:", e);
        }
      }

      return () => unsubscribe();
    };

    setupAuth();
  }, []);

  // Effect for home page speech (separated for clarity and control)
  useEffect(() => {
    // Only speak intro if voice is enabled initially AND on home page AND not spoken yet
    if (currentPage === 'home' && selectedVoice && !hasSpokenIntro && isVoiceEnabled) {
      const introText = "Hello, I am Precure AI. Your intelligent partner for business operations. We automate complex workflows for efficiency and accuracy.";
      const questionText = "Where would you like to start today? Utilities, Insurance, HR, Project Management, Finance, or Supply Chain?";

      const speakSequence = async () => {
        window.speechSynthesis.cancel();

        const introUtterance = new SpeechSynthesisUtterance(introText);
        introUtterance.lang = 'en-GB';
        introUtterance.voice = selectedVoice;

        await new Promise(resolve => {
          introUtterance.onend = resolve;
          window.speechSynthesis.speak(introUtterance);
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        const questionUtterance = new SpeechSynthesisUtterance(questionText);
        questionUtterance.lang = 'en-GB';
        questionUtterance.voice = selectedVoice;

        await new Promise(resolve => {
          questionUtterance.onend = resolve;
          window.speechSynthesis.speak(questionUtterance);
        });

        setHasSpokenIntro(true);
      };

      speakSequence();
    }
  }, [currentPage, selectedVoice, hasSpokenIntro, speakText, isVoiceEnabled]); // isVoiceEnabled added to dependencies


  const handleAuthSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
    setCurrentPage('home');
    setModalMessage(`Welcome, ${loggedInUser.displayName || loggedInUser.email}!`);
  };

  const updateUserLastSelectedCategory = useCallback(async (categoryName: string) => {
    if (user && dbRef.current) {
      try {
        const userDocRef = doc(dbRef.current, `artifacts/${appId}/users/${user.uid}`);
        await setDoc(userDocRef, { lastSelectedCategory: categoryName, lastSelectedCategoryTimestamp: serverTimestamp() }, { merge: true });
        console.log(`User ${user.uid} last selected category updated to: ${categoryName}`);
      } catch (error: any) {
        console.error("Error updating user last selected category:", error);
      }
    }
  }, [user, appId, dbRef]);

  const handleFormSubmitted = useCallback(() => {
    setModalMessage("Form submitted successfully! The bot will pick it up from there.");
    setCurrentPage('home');
  }, []);

  const handleCategoryClick = (title: string) => {
    updateUserLastSelectedCategory(title);

    if (title === "Utilities") {
      setCurrentPage('utilitiesSubCategories');
    } else if (title === "Energy (Precure)") {
      setCurrentPage('energyForm');
    } else {
      setSelectedCategory({
        title: title,
        description: getCategoryDescription(title)
      });
      setCurrentPage('categoryDetail');
    }
  };

  const handleLogout = async () => {
    try {
      if (authRef.current) {
        await signOut(authRef.current);
        setUser(null);
        setCurrentPage('auth');
        setModalMessage("You have been logged out.");
      } else {
        console.warn("Auth instance not available for logout.");
        setModalMessage("Cannot log out: Authentication service not available.");
      }
    } catch (error: any) {
      console.error("Logout error:", error);
      setModalMessage(`Logout failed: ${error.message}`);
    }
  };

  const getCategoryDescription = (title: string) => {
    switch (title) {
      case "Utilities":
        return "Streamline your utility management with Precure. Our system automates bill processing, consumption tracking, and supplier negotiations, ensuring you always get the best rates and never miss a payment. Reduce administrative burden and gain clear insights into your energy and water usage.";
      case "Insurance":
        return "Precure simplifies your insurance processes. From policy management to claims processing, our AI-powered system helps you find optimal coverage, manage renewals, and expedite claims, saving you time and reducing risks. Ensure your business is always protected with minimal effort.";
      case "HR Management":
        return "Transform your HR operations with Precure. Automate onboarding, payroll, leave management, and employee data handling. Our system ensures compliance, reduces manual errors, and frees up your HR team to focus on strategic initiatives and employee well-being.";
      case "Project Mgmt.":
        return "Enhance your project management efficiency with Precure. Our tools assist with task allocation, progress tracking, resource management, and deadline adherence. Gain real-time insights into project status, identify bottlenecks, and ensure successful project delivery every time.";
      case "Finance":
        return "Optimize your financial workflows with Precure. Automate invoicing, expense tracking, budget management, and financial reporting. Our system provides accurate, real-time financial data, helping you make informed decisions and maintain healthy cash flow.";
      case "Water Management":
        return "Efficiently manage your business's water consumption and billing with Precure. Our system helps track usage, identify leaks, and optimize water-related expenses, ensuring sustainability and cost savings.";
      case "Waste Solutions":
        return "Precure offers intelligent waste management solutions for your business. Automate waste collection scheduling, optimize recycling efforts, and ensure compliance with environmental regulations, contributing to a greener operation.";
      case "Supply Chain Management":
        return "Optimize your entire supply chain with Precure. From procurement to delivery, our system provides real-time visibility, automates logistics, and predicts demand, ensuring efficient inventory management and timely fulfillment for your B2B operations.";
      default:
        return "Discover the benefits of seamless operations with Precure. Our intelligent systems are designed to automate complex tasks, enhance accuracy, and free up your valuable time.";
    }
  };

  const renderContent = () => {
    if (!isAuthReady) {
      return React.createElement(
        'div',
        { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
        React.createElement('div', { className: 'text-xl text-gray-700' }, 'Loading app...')
      );
    }

    if (!firebaseAppRef.current || !authRef.current || !dbRef.current) {
      return React.createElement(
        'div',
        { className: 'flex items-center justify-center min-h-screen bg-red-100 p-4 text-center' },
        React.createElement(
          'div',
          { className: 'bg-white rounded-lg shadow-xl p-6 max-w-sm w-full' },
          React.createElement('h2', { className: 'text-xl font-bold text-red-700 mb-4' }, 'Configuration Error'),
          React.createElement('p', { className: 'text-gray-700' },
            'Firebase is not initialized. Please ensure you have pasted your "Precure Mobile" Firebase project configuration (apiKey, authDomain, etc.) into the `firebaseConfig` object in the code.'
          ),
          React.createElement(
            'button',
            {
              onClick: () => setModalMessage(''),
              className: 'mt-4 px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-150 ease-in-out'
            },
            'Dismiss'
          )
        )
      );
    }

    switch (currentPage) {
      case 'auth':
        return React.createElement(AuthScreen, {
          onAuthSuccess: handleAuthSuccess,
          setModalMessage: setModalMessage,
          authInstance: authRef.current,
          dbInstance: dbRef.current
        });
      case 'home':
        return React.createElement(
          'div',
          { className: 'p-6 bg-gradient-to-br from-indigo-500 to-purple-600 min-h-screen text-white font-inter flex flex-col items-center' }, // Consider changing this background for consistency too!
          React.createElement(
            'div',
            { className: 'w-full max-w-md text-center py-8' },
            React.createElement(
              'div',
              { className: 'flex items-center justify-center mb-6' },
              React.createElement('svg', { className: 'w-16 h-16 text-white', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M9.75 17L9 20l-1 1h8l-1-1l-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' })
              ),
              React.createElement('h1', { className: 'text-5xl font-extrabold ml-4 tracking-tight' }, 'Precure')
            ),
            React.createElement('p', { className: 'text-lg mb-10 leading-relaxed' },
              'Welcome to Precure, your intelligent partner for streamlining business operations. We leverage AI to automate complex workflows, ensuring efficiency and accuracy.'
            ),
            user && React.createElement(
              'p',
              { className: 'text-sm text-indigo-100 mb-4' },
              'Logged in as: ',
              React.createElement('span', { className: 'font-mono bg-indigo-700 bg-opacity-50 px-2 py-1 rounded-md break-all' }, user.displayName || user.email)
            ),
            user && React.createElement(
              'p',
              { className: 'text-sm text-indigo-100 mb-8' },
              'Your User ID: ',
              React.createElement('span', { className: 'font-mono bg-indigo-700 bg-opacity-50 px-2 py-1 rounded-md break-all' }, user.uid)
            ),
            // === NEW: Voice Toggle Switch on Home Page ===
            React.createElement(
                'div',
                { className: 'mb-8 p-4 bg-white bg-opacity-10 rounded-md flex items-center justify-between w-full max-w-xs' },
                React.createElement(ToggleSwitch, {
                    id: 'voice-toggle',
                    label: 'Enable Voice Assistant',
                    checked: isVoiceEnabled,
                    onChange: setIsVoiceEnabled
                })
            ),
            React.createElement('h3', { className: 'text-xl font-semibold text-white mb-4' }, 'Available Services'),
            React.createElement(
              'div',
              { className: 'grid grid-cols-2 gap-6' },
              React.createElement(CategoryCard, { title: 'Utilities', icon: '💡', onClick: () => handleCategoryClick('Utilities') }),
              React.createElement(CategoryCard, { title: 'Insurance', icon: '🛡️', onClick: () => handleCategoryClick('Insurance') }),
              React.createElement(CategoryCard, { title: 'HR Management', icon: '👥', onClick: () => handleCategoryClick('HR Management') }),
              React.createElement(CategoryCard, { title: 'Project Mgmt.', icon: '📊', onClick: () => handleCategoryClick('Project Mgmt.') }),
              React.createElement(CategoryCard, { title: 'Finance', icon: '💰', onClick: () => handleCategoryClick('Finance') }),
              React.createElement(CategoryCard, {
                title: 'Supply Chain Management',
                icon: '📦',
                onClick: () => handleCategoryClick('Supply Chain Management')
              })
            ),
            user && React.createElement(
              'button',
              {
                onClick: handleLogout,
                className: 'mt-10 px-6 py-3 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 transition duration-150 ease-in-out'
              },
              'Logout'
            )
          )
        );

      case 'utilitiesSubCategories':
        return React.createElement(UtilitiesSubCategoriesScreen, { onBack: () => setCurrentPage('home'), onSelectSubCategory: handleCategoryClick, speakText: speakText });
      case 'energyForm':
        return React.createElement(EnergyForm, {
          userId: user ? user.uid : null,
          onBack: () => setCurrentPage('utilitiesSubCategories'),
          setModalMessage: setModalMessage,
          onFormSubmitted: handleFormSubmitted,
          dbInstance: dbRef.current
        });
      case 'categoryDetail':
        return React.createElement(CategoryDetailScreen, { ...selectedCategory, onBack: () => setCurrentPage('home'), speakText: speakText });
      default:
        return null;
    }
  };

  return React.createElement(
    'div',
    { className: 'App' },
    renderContent(),
    React.createElement(Modal, { message: modalMessage, onClose: () => setModalMessage('') })
  );
};

export default App;